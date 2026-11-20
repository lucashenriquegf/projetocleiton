import { NextRequest, NextResponse } from 'next/server';

import { getProduct, ProductError, setProductArchived, updateProduct } from '@/db/product-repository';
import type { ProductInput } from '@/lib/domain';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const product = await getProduct((await context.params).id);
    return product
      ? NextResponse.json(product)
      : NextResponse.json({ message: 'Produto não encontrado.' }, { status: 404 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as ProductInput | { archived: boolean };
    if ('archived' in body) return NextResponse.json(await setProductArchived(id, body.archived));
    return NextResponse.json(await updateProduct(id, body));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await setProductArchived((await context.params).id, true));
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  return NextResponse.json(
    { message: error instanceof Error ? error.message : 'Não foi possível atualizar o produto.' },
    { status: error instanceof ProductError ? error.status : 500 },
  );
}
