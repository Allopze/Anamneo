#!/usr/bin/env node

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function normalizeConditionName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
  }
  return '';
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    throw new Error('Uso: npm --prefix backend run import:cie10 -- ./cie10.csv');
  }

  const records = parse(fs.readFileSync(file), {
    bom: true,
    columns: (headers) => headers.map((header) => String(header).trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  });

  let created = 0;
  let updated = 0;

  for (const row of records) {
    const code = pick(row, ['cie_code', 'cie10', 'code', 'codigo', 'código']);
    const name = pick(row, ['name', 'description', 'descripcion', 'descripción', 'glosa']);
    if (!code || !name) continue;

    const normalizedName = normalizeConditionName(name);
    const existing = await prisma.conditionCatalog.findFirst({
      where: {
        OR: [
          { cieCode: code.toUpperCase() },
          { normalizedName },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.conditionCatalog.update({
        where: { id: existing.id },
        data: {
          name,
          cieCode: code.toUpperCase(),
          normalizedName,
          active: true,
        },
      });
      updated += 1;
    } else {
      await prisma.conditionCatalog.create({
        data: {
          name,
          cieCode: code.toUpperCase(),
          normalizedName,
          synonyms: '[]',
          tags: JSON.stringify(['CIE-10']),
          active: true,
        },
      });
      created += 1;
    }
  }

  console.log(`CIE-10 importado: ${created} creados, ${updated} actualizados`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
