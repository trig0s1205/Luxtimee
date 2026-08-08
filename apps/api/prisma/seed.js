"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const shippingZones = [
        { name: 'Bucaramanga', cost: 10000, isNational: false },
        { name: 'Floridablanca', cost: 10000, isNational: false },
        { name: 'La Cumbre', cost: 12000, isNational: false },
        { name: 'Norte de Bucaramanga', cost: 14000, isNational: false },
        { name: 'Girón', cost: 14000, isNational: false },
        { name: 'Envíos Nacionales', cost: 17000, isNational: true },
    ];
    for (const zone of shippingZones) {
        await prisma.shippingZone.upsert({
            where: { name: zone.name },
            update: { cost: zone.cost, isNational: zone.isNational },
            create: zone,
        });
    }
    await prisma.user.upsert({
        where: { email: 'alvaro@luxtime.co' },
        update: { role: client_1.Role.SUPER_ADMIN, name: 'Álvaro' },
        create: {
            email: 'alvaro@luxtime.co',
            name: 'Álvaro',
            role: client_1.Role.SUPER_ADMIN,
        },
    });
    await prisma.user.upsert({
        where: { email: 'lidia@luxtime.co' },
        update: { role: client_1.Role.ADMIN, name: 'Lidia' },
        create: {
            email: 'lidia@luxtime.co',
            name: 'Lidia',
            role: client_1.Role.ADMIN,
        },
    });
    const settings = [
        {
            key: 'whatsapp_link',
            value: { url: 'https://wa.me/573000000000', messagePrefix: 'Hola LUXTIMEE, deseo comprar:' },
        },
        {
            key: 'commission_percent',
            value: { percent: 5 },
        },
        {
            key: 'legal_documents',
            value: {
                termsPublished: false,
                privacyPublished: false,
                termsDraft: 'Borrador de Términos y Condiciones — pendiente de aprobación de Álvaro.',
                privacyDraft: 'Borrador de Política de Tratamiento de Datos — pendiente de aprobación de Álvaro.',
            },
        },
        {
            key: 'profit_config',
            value: { defaultProfitPercent: 30 },
        },
    ];
    for (const setting of settings) {
        await prisma.setting.upsert({
            where: { key: setting.key },
            update: { value: setting.value },
            create: setting,
        });
    }
    const rolex = await prisma.brand.upsert({
        where: { slug: 'rolex' },
        update: {},
        create: { name: 'Rolex', slug: 'rolex' },
    });
    const warranty = await prisma.warrantyTemplate.upsert({
        where: { id: 'seed-warranty-lux' },
        update: {},
        create: {
            id: 'seed-warranty-lux',
            name: 'Garantía LUXTIMEE Estándar',
            durationMonths: 12,
            terms: 'Cobertura por defectos de fabricación durante 12 meses desde la fecha de pago completo.',
        },
    });
    const care = await prisma.careTemplate.upsert({
        where: { id: 'seed-care-lux' },
        update: {},
        create: {
            id: 'seed-care-lux',
            name: 'Cuidados Premium',
            instructions: 'Evite contacto con químicos, agua salada y campos magnéticos intensos. Limpie con paño suave.',
        },
    });
    await prisma.watch.upsert({
        where: { slug: 'rolex-submariner-date' },
        update: {},
        create: {
            brandId: rolex.id,
            model: 'Submariner Date',
            slug: 'rolex-submariner-date',
            movementType: 'Automático',
            specs: {
                caseMaterial: 'Acero Oystersteel',
                caseDiameter: '41mm',
                waterResistance: '300m',
            },
            retailPrice: 18500000,
            wholesalePrice: 16200000,
            cost: 12000000,
            profitPercent: 35,
            stock: 3,
            warrantyTemplateId: warranty.id,
            careTemplateId: care.id,
        },
    });
    console.log('Seed completado: zonas, usuarios staff, settings y catálogo demo.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map