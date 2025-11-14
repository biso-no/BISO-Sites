import { notFound } from 'next/navigation';
import DepartmentEditor from '../shared/department-editor';
import { getDepartmentById, getDepartmentTypes } from '@/lib/actions/departments';
import { getCampuses } from '@/app/actions/campus';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function DepartmentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [department, campuses, types] = await Promise.all([
    getDepartmentById(id),
    getCampuses(),
    getDepartmentTypes()
  ]);
  
  if (!department) {
    notFound();
  }
  
  return (
    <DepartmentEditor 
      department={department} 
      campuses={campuses.map(c => ({ $id: c.$id, name: c.name }))}
      types={types}
    />
  );
}
