import { NextRequest, NextResponse } from 'next/server';

import { createProduct, listProducts, ProductError } from '@/db/product-repository';
import type { ProductInput } from '@/lib/domain';

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    return NextResponse.json(await listProducts({
      query: search.get('busca') ?? undefined,
      status: search.get('situacao') ?? undefined,
      unit: search.get('unidade') ?? undefined,
      packaging: search.get('embalagem') ?? undefined,
      page: Number(search.get('pagina')) || 1,
      pageSize: Number(search.get('porPagina')) || 25,
    }));
  } catch (error) {
    return handleError(error, 'Não foi possível carregar os produtos.');
  }
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await createProduct((await request.json()) as ProductInput), { status: 201 });
  } catch (error) {
    return handleError(error, 'Não foi possível cadastrar o produto.');
  }
}

function handleError(error: unknown, fallback: string) {
  return NextResponse.json(
    { message: error instanceof Error ? error.message : fallback },
    { status: error instanceof ProductError ? error.status : 500 },
  );
}
