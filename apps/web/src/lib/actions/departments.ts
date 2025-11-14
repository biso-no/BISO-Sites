import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { ContentTranslations, ContentType, Status } from "@repo/api/types/appwrite";
import { Locale } from "@/i18n/config";

export type DepartmentTranslation = ContentTranslations & {
  news?: ContentTranslations[];
  products?: ContentTranslations[];
}

export async function getDepartments({ 
  campusId, 
  isActive = true,
  locale
}: { 
  campusId?: string; 
  isActive?: boolean;
  locale: Locale;
}): Promise<ContentTranslations[]> {
  const { db } = await createSessionClient();
  
  const queries = [
    Query.equal('content_type', ContentType.DEPARTMENT),
    Query.equal('locale', locale),
    Query.select([
      '$id',
      'content_id',
      'locale',
      'title',
      'description',
      'short_description',
      'department_ref.$id',
      'department_ref.Id',
      'department_ref.Name',
      'department_ref.campus_id',
      'department_ref.logo',
      'department_ref.active',
      'department_ref.type',
      'department_ref.campus.$id',
      'department_ref.campus.name',
      'department_ref.socials.*',
      'department_ref.boardMembers.*'
    ]),
    Query.orderAsc('title')
  ];
  
  if (isActive) {
    queries.push(Query.equal("department_ref.active", true));
  }
  
  if (campusId && campusId !== "all") {
    queries.push(Query.equal("department_ref.campus_id", campusId));
  }
  
  const departments = await db.listRows<ContentTranslations>("app", "content_translations", queries);
  
  return departments.rows;
}

export async function getDepartmentById(
  id: string, 
  locale: Locale
): Promise<DepartmentTranslation | null> {
  try {
    const { db } = await createSessionClient();
  
    // Get department translation
    const result = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.DEPARTMENT),
      Query.equal('content_id', id),
      Query.equal('locale', locale),
      Query.select([
        '$id',
        'content_id',
        'locale',
        'title',
        'description',
        'short_description',
        'department_ref.*',
        'department_ref.socials.*',
        'department_ref.boardMembers.*'
      ])
    ]);
    
    if (!result.rows[0]) return null;
    
    const deptTranslation = result.rows[0];
    
    // Fetch news for this department (with translations)
    const newsResults = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.NEWS),
      Query.equal('news_ref.department_id', id),
      Query.equal('locale', locale),
      Query.equal('news_ref.status', Status.PUBLISHED),
      Query.select(['$id', 'content_id', 'locale', 'title', 'description', 'short_description', 'news_ref.*']),
      Query.orderDesc('$createdAt')
    ]);
    
    // Fetch products for this department (with translations)
    const productsResults = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.equal('product_ref.departmentId', id),
      Query.equal('locale', locale),
      Query.equal('product_ref.status', Status.PUBLISHED),
      Query.select(['$id', 'content_id', 'locale', 'title', 'description', 'short_description', 'product_ref.*']),
      Query.orderDesc('$createdAt')
    ]);
    
    return {
      ...deptTranslation,
      news: newsResults.rows,
      products: productsResults.rows
    };
  } catch (error) {
    console.error('Error fetching department:', error);
    return null;
  }
}
