import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WatchesService } from '../watches/watches.service';
import { CreateWatchDto } from '../watches/dto';
import { resolveSkuPrefix } from '../watches/utils/sku.util';
import { isWatchCatalogReady } from '../watches/utils/watch-pending.util';
import {
  GENDER_VALUES,
  IMPORT_KEY_FIELD,
} from './import.constants';
import {
  assertImportFile,
  parseImportBuffer,
  type RawImportRow,
} from './import-parser.util';
import {
  closestName,
  normalizeNameKey,
  parseIntField,
  parseSiNo,
  neutralizeSpreadsheetText,
} from './import-normalize.util';

export type FieldIssue = { field: string; message: string };

export type PreviewRow = {
  rowNumber: number;
  importKey: string;
  status: 'ok' | 'error' | 'ejemplo' | 'ya-importado';
  errors: FieldIssue[];
  warnings: FieldIssue[];
  normalized: Record<string, unknown>;
  skuPrefixEstimado: string | null;
};

export type PreviewResult = {
  rows: PreviewRow[];
  summary: {
    ok: number;
    error: number;
    ejemplo: number;
    yaImportado: number;
    catalogReady: number;
    posSellable: number;
  };
};

type Lookups = {
  brands: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  mechanisms: { id: string; name: string }[];
  careTemplates: { id: string; name: string }[];
  existingKeys: Set<string>;
};

@Injectable()
export class WatchesImportService {
  constructor(
    private prisma: PrismaService,
    private watchesService: WatchesService,
  ) {}

  async preview(file: Express.Multer.File, role: Role): Promise<PreviewResult> {
    const rows = await this.loadRows(file);
    const lookups = await this.loadLookups(rows);
    const previewRows = rows.map((r) => this.validateRow(r, lookups, role));
    this.markDuplicateKeys(previewRows);
    return { rows: previewRows, summary: this.summarize(previewRows) };
  }

  async commit(
    file: Express.Multer.File,
    role: Role,
    confirm: boolean,
  ): Promise<
    Array<{
      importKey: string;
      ok: boolean;
      sku?: string;
      watchId?: string;
      error?: string;
    }>
  > {
    if (!confirm) {
      return [{ importKey: '', ok: false, error: 'Debes enviar confirm=true' }];
    }
    const preview = await this.preview(file, role);
    const results: Array<{
      importKey: string;
      ok: boolean;
      sku?: string;
      watchId?: string;
      error?: string;
    }> = [];

    for (const row of preview.rows) {
      if (row.status === 'ejemplo') continue;
      if (row.status === 'ya-importado') {
        results.push({
          importKey: row.importKey,
          ok: true,
          error: 'ya-importado',
        });
        continue;
      }
      if (row.status !== 'ok') {
        results.push({
          importKey: row.importKey || `fila-${row.rowNumber}`,
          ok: false,
          error: row.errors.map((e) => e.message).join('; '),
        });
        continue;
      }
      try {
        const dto = row.normalized as unknown as CreateWatchDto;
        const watch = await this.watchesService.create(dto, role);
        results.push({
          importKey: row.importKey,
          ok: true,
          sku: watch.sku,
          watchId: watch.id,
        });
      } catch (err) {
        results.push({
          importKey: row.importKey,
          ok: false,
          error: err instanceof Error ? err.message : 'Error al crear',
        });
      }
    }
    return results;
  }

  async findByImportKeys(keys: string[]) {
    const unique = [
      ...new Set(keys.map((k) => neutralizeSpreadsheetText(k).trim()).filter(Boolean)),
    ].slice(0, 300);
    if (!unique.length) return [];

    const watches = await this.prisma.watch.findMany({
      where: {
        deletedAt: null,
        OR: unique.map((k) => ({
          specs: { path: [IMPORT_KEY_FIELD], equals: k },
        })),
      },
      select: {
        id: true,
        sku: true,
        model: true,
        specs: true,
        frontImageUrl: true,
        backImageUrl: true,
        primaryImageUrl: true,
        secondaryImageUrl: true,
        videoUrl: true,
      },
    });

    const byKey = new Map<string, (typeof watches)[number]>();
    for (const w of watches) {
      const specs =
        w.specs && typeof w.specs === 'object' && !Array.isArray(w.specs)
          ? (w.specs as Record<string, unknown>)
          : {};
      const key = String(specs[IMPORT_KEY_FIELD] ?? '');
      if (key) byKey.set(key, w);
    }

    return unique.map((importKey) => {
      const w = byKey.get(importKey);
      if (!w) {
        return {
          importKey,
          watchId: null,
          sku: null,
          model: null,
          hasFront: false,
          hasBack: false,
          hasVideo: false,
        };
      }
      return {
        importKey,
        watchId: w.id,
        sku: w.sku,
        model: w.model,
        hasFront: Boolean(w.frontImageUrl || w.primaryImageUrl),
        hasBack: Boolean(w.backImageUrl || w.secondaryImageUrl),
        hasVideo: Boolean(w.videoUrl),
      };
    });
  }

  private async loadRows(file: Express.Multer.File) {
    const { isXlsx } = assertImportFile(file);
    return parseImportBuffer(file.buffer, isXlsx ? 'xlsx' : 'csv');
  }

  private async loadLookups(rows: RawImportRow[]): Promise<Lookups> {
    const [brands, categories, mechanisms, careTemplates] = await Promise.all([
      this.prisma.brand.findMany({ select: { id: true, name: true } }),
      this.prisma.category.findMany({ select: { id: true, name: true } }),
      this.prisma.mechanism.findMany({
        select: { id: true, name: true },
      }),
      this.prisma.careTemplate.findMany({ select: { id: true, name: true } }),
    ]);

    const keys = rows
      .map((r) => String(r.values.importKey ?? '').trim())
      .filter(Boolean);
    const existingKeys = new Set<string>();
    if (keys.length) {
      const found = await this.prisma.watch.findMany({
        where: {
          deletedAt: null,
          OR: keys.map((k) => ({
            specs: { path: [IMPORT_KEY_FIELD], equals: k },
          })),
        },
        select: { specs: true },
      });
      for (const w of found) {
        const specs =
          w.specs && typeof w.specs === 'object' && !Array.isArray(w.specs)
            ? (w.specs as Record<string, unknown>)
            : {};
        const k = String(specs[IMPORT_KEY_FIELD] ?? '');
        if (k) existingKeys.add(k);
      }
    }

    return { brands, categories, mechanisms, careTemplates, existingKeys };
  }

  private validateRow(
    row: RawImportRow,
    lookups: Lookups,
    role: Role,
  ): PreviewRow {
    const v = row.values;
    const errors: FieldIssue[] = [];
    const warnings: FieldIssue[] = [];
    const importKey = String(v.importKey ?? '').trim();
    const fila = String(v._fila ?? '').trim().toUpperCase();

    if (fila === 'EJEMPLO') {
      return {
        rowNumber: row.rowNumber,
        importKey,
        status: 'ejemplo',
        errors: [],
        warnings: [],
        normalized: {},
        skuPrefixEstimado: null,
      };
    }

    if (!importKey) {
      errors.push({ field: 'importKey', message: 'Nº de carga obligatorio' });
    } else if (lookups.existingKeys.has(importKey)) {
      return {
        rowNumber: row.rowNumber,
        importKey,
        status: 'ya-importado',
        errors: [],
        warnings: [],
        normalized: {},
        skuPrefixEstimado: null,
      };
    }

    const model = String(v.model ?? '').trim();
    if (model.length < 2) {
      errors.push({ field: 'model', message: 'Modelo mínimo 2 caracteres' });
    }

    const brandName = String(v.brand ?? '').trim();
    const brand = this.resolveNamed(brandName, lookups.brands, 'brand', errors);

    const categoryName = String(v.category ?? '').trim();
    let categoryId: string | undefined;
    if (categoryName) {
      const cat = this.resolveNamed(
        categoryName,
        lookups.categories,
        'category',
        errors,
      );
      categoryId = cat?.id;
    } else {
      warnings.push({
        field: 'category',
        message: 'Sin clase: quedará pendiente de catálogo',
      });
    }

    const mechanismName = String(v.mechanism ?? '').trim();
    let mechanismId: string | undefined;
    const movementType = mechanismName || 'Automático';
    if (mechanismName) {
      const mech = this.resolveNamed(
        mechanismName,
        lookups.mechanisms,
        'mechanism',
        errors,
      );
      if (mech) {
        mechanismId = mech.id;
      }
    } else {
      warnings.push({
        field: 'mechanism',
        message: 'Sin mecanismo: quedará pendiente de catálogo',
      });
    }

    const careName = String(v.careTemplate ?? '').trim();
    let careTemplateId: string | undefined;
    if (careName) {
      const care = this.resolveNamed(
        careName,
        lookups.careTemplates,
        'careTemplate',
        errors,
      );
      careTemplateId = care?.id;
    }

    const genderRaw = String(v.gender ?? '').trim();
    let gender: string | undefined;
    if (genderRaw) {
      const g = GENDER_VALUES.find(
        (x) => normalizeNameKey(x) === normalizeNameKey(genderRaw),
      );
      if (!g) {
        errors.push({
          field: 'gender',
          message: 'Género debe ser Hombre, Mujer o Unisex',
        });
      } else {
        gender = g;
      }
    }

    const retailPrice = parseIntField(v.retailPrice);
    const wholesalePrice = parseIntField(v.wholesalePrice);
    const stock = parseIntField(v.stock);
    if (retailPrice == null || retailPrice < 0) {
      errors.push({ field: 'retailPrice', message: 'Precio detal entero ≥ 0' });
    }
    if (wholesalePrice == null || wholesalePrice < 0) {
      errors.push({
        field: 'wholesalePrice',
        message: 'Precio mayor entero ≥ 0',
      });
    }
    if (stock == null || stock < 0) {
      errors.push({ field: 'stock', message: 'Stock entero ≥ 0' });
    }

    let warrantyMonths = parseIntField(v.warrantyMonths);
    if (warrantyMonths == null) warrantyMonths = 1;
    if (warrantyMonths < 0 || warrantyMonths > 120) {
      errors.push({
        field: 'warrantyMonths',
        message: 'Garantía entre 0 y 120 meses',
      });
    }

    let cost = parseIntField(v.cost);
    if (cost != null && cost < 0) {
      errors.push({ field: 'cost', message: 'Costo entero ≥ 0' });
      cost = null;
    }
    if (cost != null && role !== Role.SUPER_ADMIN) {
      warnings.push({
        field: 'cost',
        message: 'Costo ignorado (solo SUPER_ADMIN)',
      });
      cost = null;
    }

    const description = String(v.description ?? '').trim();
    if (!description) {
      warnings.push({
        field: 'description',
        message: 'Sin descripción: pendiente de catálogo',
      });
    }
    if (retailPrice != null && retailPrice <= 0) {
      warnings.push({
        field: 'retailPrice',
        message: 'Precio 0: no listo para catálogo',
      });
    }
    if (wholesalePrice != null && wholesalePrice <= 0) {
      warnings.push({
        field: 'wholesalePrice',
        message: 'Mayor 0: no listo para catálogo',
      });
    }

    const limited = parseSiNo(v.isLimitedEdition);
    if (v.isLimitedEdition && limited === undefined) {
      errors.push({
        field: 'isLimitedEdition',
        message: 'Usa SI o NO',
      });
    }

    const functions = String(v.functions ?? '')
      .split(';')
      .map((f) => f.trim())
      .filter(Boolean);

    const skuPrefixEstimado =
      retailPrice != null && retailPrice >= 0
        ? resolveSkuPrefix(retailPrice, gender)
        : null;

    const normalized: CreateWatchDto = {
      brandId: brand?.id,
      categoryId,
      mechanismId,
      careTemplateId,
      model,
      reference: String(v.reference ?? '').trim() || undefined,
      gender,
      warrantyMonths: warrantyMonths ?? 1,
      movementType,
      movementCaliber: String(v.movementCaliber ?? '').trim() || undefined,
      caseDiameter: String(v.caseDiameter ?? '').trim() || undefined,
      caseMaterial: String(v.caseMaterial ?? '').trim() || undefined,
      bezelMaterial: String(v.bezelMaterial ?? '').trim() || undefined,
      dialColor: String(v.dialColor ?? '').trim() || undefined,
      crystalType: String(v.crystalType ?? '').trim() || undefined,
      strapMaterial: String(v.strapMaterial ?? '').trim() || undefined,
      waterResistance: String(v.waterResistance ?? '').trim() || undefined,
      functions: functions.length ? functions : undefined,
      retailPrice: retailPrice ?? 0,
      wholesalePrice: wholesalePrice ?? 0,
      stock: stock ?? 0,
      cost: cost ?? undefined,
      description: description || undefined,
      isLimitedEdition: limited ?? false,
      limitedEditionNumber:
        String(v.limitedEditionNumber ?? '').trim() || undefined,
      isPublished: false,
      specs: importKey ? { [IMPORT_KEY_FIELD]: importKey } : {},
    };

    const catalogReady =
      errors.length === 0 &&
      isWatchCatalogReady({
        model: normalized.model!,
        retailPrice: normalized.retailPrice!,
        wholesalePrice: normalized.wholesalePrice!,
        stock: normalized.stock!,
        isPublished: false,
        categoryId: normalized.categoryId,
        gender: normalized.gender,
        description: normalized.description,
        movementType: normalized.movementType ?? 'Automático',
        mechanismId: normalized.mechanismId,
        images: [],
        videoUrl: null,
      });

    return {
      rowNumber: row.rowNumber,
      importKey,
      status: errors.length ? 'error' : 'ok',
      errors,
      warnings,
      normalized: {
        ...normalized,
        _catalogReady: catalogReady,
        _posSellable: (normalized.stock ?? 0) > 0,
      },
      skuPrefixEstimado,
    };
  }

  private resolveNamed<T extends { id: string; name: string }>(
    name: string,
    list: T[],
    field: string,
    errors: FieldIssue[],
  ): T | undefined {
    if (!name) {
      if (field === 'brand') {
        errors.push({ field, message: 'Marca obligatoria' });
      }
      return undefined;
    }
    const key = normalizeNameKey(name);
    const hit = list.find((x) => normalizeNameKey(x.name) === key);
    if (hit) return hit;
    const suggestion = closestName(
      name,
      list.map((x) => x.name),
    );
    errors.push({
      field,
      message: suggestion
        ? `No existe "${name}". ¿Quisiste decir "${suggestion}"?`
        : `No existe "${name}"`,
    });
    return undefined;
  }

  private markDuplicateKeys(rows: PreviewRow[]) {
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (!row.importKey || row.status === 'ejemplo') continue;
      if (seen.has(row.importKey)) {
        row.status = 'error';
        row.errors.push({
          field: 'importKey',
          message: `Nº de carga duplicado en el archivo (también fila ${seen.get(row.importKey)})`,
        });
      } else {
        seen.set(row.importKey, row.rowNumber);
      }
    }
  }

  private summarize(rows: PreviewRow[]): PreviewResult['summary'] {
    const summary = {
      ok: 0,
      error: 0,
      ejemplo: 0,
      yaImportado: 0,
      catalogReady: 0,
      posSellable: 0,
    };
    for (const r of rows) {
      if (r.status === 'ok') {
        summary.ok++;
        if (r.normalized._catalogReady) summary.catalogReady++;
        if (r.normalized._posSellable) summary.posSellable++;
      } else if (r.status === 'error') summary.error++;
      else if (r.status === 'ejemplo') summary.ejemplo++;
      else if (r.status === 'ya-importado') summary.yaImportado++;
    }
    return summary;
  }
}
