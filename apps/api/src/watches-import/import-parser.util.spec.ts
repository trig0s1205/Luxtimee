import {
  assertImportFile,
  parseImportBuffer,
} from './import-parser.util';

function csvFile(content: string, name = 'relojes.csv'): Express.Multer.File {
  const buffer = Buffer.from(content, 'utf8');
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: 'text/csv',
    size: buffer.length,
    buffer,
    destination: '',
    filename: name,
    path: '',
    stream: null as unknown as Express.Multer.File['stream'],
  };
}

describe('import-parser', () => {
  it('parsea CSV con coma y fila técnica', async () => {
    const csv = [
      'Fila,Nº,Marca,Modelo,Ref,Clase,Género,Mecanismo,Detal,Mayor,Costo,Stock,Garantía,Desc,Dial,Diam,Caja,Bisel,Cristal,Correa,Agua,Calibre,Funcs,Cuidado,Limitada,Núm',
      '_fila,importKey,brand,model,reference,category,gender,mechanism,retailPrice,wholesalePrice,cost,stock,warrantyMonths,description,dialColor,caseDiameter,caseMaterial,bezelMaterial,crystalType,strapMaterial,waterResistance,movementCaliber,functions,careTemplate,isLimitedEdition,limitedEditionNumber',
      ',001,Rolex,Submariner,,Deportivo,Hombre,Automático,5000000,4000000,2000000,1,12,Desc,,,Acero,,,,50m,,,SI,1/100',
      'EJEMPLO,000,x,x,,,,,0,0,,0,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,,',
    ].join('\n');
    const rows = await parseImportBuffer(Buffer.from(csv), 'csv');
    expect(rows).toHaveLength(2);
    expect(rows[0].values.importKey).toBe('001');
    expect(rows[0].values.brand).toBe('Rolex');
    expect(rows[1].values._fila).toBe('EJEMPLO');
  });

  it('parsea CSV con ; y BOM', async () => {
    const csv =
      '\uFEFF_fila;importKey;brand;model;reference;category;gender;mechanism;retailPrice;wholesalePrice;cost;stock;warrantyMonths;description;dialColor;caseDiameter;caseMaterial;bezelMaterial;crystalType;strapMaterial;waterResistance;movementCaliber;functions;careTemplate;isLimitedEdition;limitedEditionNumber\n' +
      ';002;Seiko;Presage;;Clásico;Mujer;Automático;1200000;900000;;2;12;Con tilde café;;;;;;;fecha;hora;;NO;';
    const rows = await parseImportBuffer(Buffer.from(csv), 'csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].values.importKey).toBe('002');
    expect(rows[0].values.description).toContain('café');
  });

  it('rechaza extensión inválida', () => {
    expect(() =>
      assertImportFile(csvFile('x', 'relojes.txt')),
    ).toThrow(/xlsx o \.csv/);
  });

  it('rechaza xlsx sin firma ZIP', () => {
    const buf = Buffer.from('not-a-zip');
    const file = csvFile('x', 'a.xlsx');
    file.buffer = buf;
    file.size = buf.length;
    expect(() => assertImportFile(file)).toThrow(/ZIP/);
  });
});
