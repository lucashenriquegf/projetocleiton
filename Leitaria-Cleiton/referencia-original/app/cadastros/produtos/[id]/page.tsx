import { ProductFormScreen } from '@/components/products/product-form-screen';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductFormScreen productId={id} />;
}
