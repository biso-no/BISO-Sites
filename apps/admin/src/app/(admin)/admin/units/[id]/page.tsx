import { notFound } from 'next/navigation';
import { DepartmentDetails } from './_components/department-details';
import { getCampuses } from '@/lib/admin/db';
import { getDepartmentTypes } from '@/lib/admin/departments';
import { createSessionClient } from '@/lib/appwrite';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

async function getDepartmentById(id: string) {
  try {
    const { db } = await createSessionClient();
    // Don't use select to ensure we get all fields including relationships
    const department = await db.getDocument("app", "departments", id);
    
    let campusName = '';
    if (department.campus_id) {
      try {
        const campus = await db.getDocument("app", "campus", department.campus_id);
        campusName = campus.name;
      } catch (error) {
        console.error("Error fetching campus name:", error);
      }
    }
    
    // Convert the document to our Department type
    return {
      $id: department.$id,
      name: department.Name,
      campus_id: department.campus_id,
      campusName: campusName,
      logo: department.logo || '',
      type: department.type || '',
      description: department.description || '',
      active: department.active === false ? false : true,
      userCount: department.users?.length || 0
    };
  } catch (error) {
    console.error("Error fetching department:", error);
    return null;
  }
}

export default async function DepartmentPage({ params }: { params: { id: string } }) {
  const [department, campuses, types] = await Promise.all([
    getDepartmentById(params.id),
    getCampuses(),
    getDepartmentTypes()
  ]);
  
  if (!department) {
    notFound();
  }
  
  return (
    <DepartmentDetails 
      department={department} 
      campuses={campuses}
      departmentTypes={types}
    />
  );
}
