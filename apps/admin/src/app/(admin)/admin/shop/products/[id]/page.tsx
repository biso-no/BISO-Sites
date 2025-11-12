import { notFound } from 'next/navigation'
import { getProduct } from '@/app/actions/products'
import { EditProduct } from '../_components/edit-product'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProductEditPage({ params }: Props) {
  const { id } = await params
  
  const product = await getProduct(id)
  
  if (!product) {
    notFound()
  }

  return <EditProduct product={product} />
}