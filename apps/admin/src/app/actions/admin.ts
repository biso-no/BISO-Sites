"use server"
import { createSessionClient } from "@repo/api/server";
import { User } from "@/lib/types/user";
import { Post } from "@/lib/types/post";
import { Expense } from "@/lib/types/expense";
import { Department } from "@/lib/types/department";
import { Campus } from "@repo/api/types/appwrite";
import { attachmentImage } from "@/lib/types/attachmentImage";
import { Query } from "@repo/api";
import { ID } from "@repo/api";
import { revalidatePath } from "next/cache";


export async function getUserRoles() {

  const availableRoles = ['Admin', 'pr', 'finance', 'hr', 'users', 'Control Committee'];

  const { teams } = await createSessionClient();

  const response = await teams.list([
    Query.equal('name', availableRoles),
  ]);
  return response.teams.map(team => team.name);
}

export async function getUsers() {
  const { db } = await createSessionClient();
  const response = await db.listRows<User>('app', 'user', [
    Query.limit(100)
  ]);

  return response.rows
}

export async function getPosts(){
  const { db } = await createSessionClient();
  const response = await db.listRows<Post>('app', 'news', [
    Query.limit(100)
  ]);

  return response.rows

}

export async function getPost(postId: string){
  const { db } = await createSessionClient();
  const response = await db.getRow<Post>('app', 'news', postId
  );

  return response

}

export async function updatePost(postId: string, post: Post){
  const { db } = await createSessionClient();
  const response = await db.getRow('app', 'news', postId
  );
  revalidatePath('/admin/posts')
  return db.updateRow(
    'app', // databaseId
    'news', // collectionId
    postId, // documentId
    {
      "title": post.title,
      "url": post.url,
      "content": post.content,
      "status": post.status,
      "image":post.image,
      "department_id":post.department,
      "campus_id":post.campus_id,
      "created_at":post.$createdAt,
      "updated_at":post.$updatedAt,
      "department":post.department,
      "campus":post.campus_id
    }, // data (optional)
  )

}

export async function createPost(post: Post){
  const { db } = await createSessionClient();

  const result = await db.createRow<Post>(
    'app', // databaseId
    'news', // collectionId
    "unique()",
    {
      "title": post.title,
      "url": post.url,
      "content": post.content,
      "status": post.status,
      "image":post.image,
      "department":post.department.$id,
      "campus_id":post.campus_id.$id,
      "created_at":post.$createdAt,
      "updated_at":post.$updatedAt,
      "department":post.department.$id,
      "campus":post.campus_id.$id
    }, // data (optional)
);
  revalidatePath('/admin/posts')
  return result

}


export async function deletePost(postId: string){
  const { db } = await createSessionClient();

const result = await db.deleteRow(
  'app', // databaseId
  'news', // collectionId
  postId // documentId
);
revalidatePath('/admin/posts')
return result

}

export async function getExpenses() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Expense>('app', 'expense', [
    Query.limit(100)
  ]);

  return response.rows
}

async function getExpensesByLoggedInUser() {
       
  
   
  //console.log(user.user.$id)
  //console.log("here")
  const { db, account} = await createSessionClient();
  const user = await account.get();
  //console.log(user.$id)
  const response = await db.listRows<Expense>('app', 'expense', [Query.equal("userId", user.$id),
    Query.limit(100)
  ]);

  return response.rows
}


export async function getExpense(id: string) {
  const { db } = await createSessionClient();
  const response = await db.getRow('app', 'expense', id);


  return response
}




async function addExpense(formData: FormData) {
  const { db, account} = await createSessionClient();
  const user = await account.get();
  const response = await db.createRow<Expense>(
    'app', // databaseId
    'expense', // collectionId
    ID.unique(),
    {
      campus: formData.campus as Campus,
      department: formData.department as Department,
      bank_account: formData.bank_account,
      description: formData.description,
      expenseAttachments: formData.expense_attachments_ids,
      total: formData.total,
      prepayment_amount: formData.prepayment_amount,
      user: user.$id,
      userId: user.$id
    }, // data
  );

  return response
}

async function updateExpense(expenseId: string, expense: Expense) {
  console.log(expenseId)
  const { db, account } = await createSessionClient();
  const user = await account.get();
  const response = await db.updateRow<Expense>(
    'app', // databaseId
    'expense', // collectionId
    expenseId,
    {
      campus: expense.campus.$id,
      department: expense.department.$id,
      bank_account: expense.bank_account,
      description: expense.description,
      expenseAttachments: expense.expenseAttachments,
      total: expense.total,
      prepayment_amount: expense.prepayment_amount,
      user: user.$id,
      userId: user.$id
    }, // data
  );
}


  async function updateExpenseStatus(expenseId: string,  status: string) {
    console.log(expenseId)
    const { db } = await createSessionClient();
    const response = await db.updateRow<Expense>(
      'app', // databaseId
      'expense', // collectionId
      expenseId,
      {
        status: status
      }, // data
    );

    return response
  }


  async function addExpenseAttachment(data: ExpenseAttachment) {
    const { db } = await createSessionClient();
    const response = await db.createRow<ExpenseAttachment>(
      'app', // databaseId
      'expense_attachments', // collectionId
      ID.unique(),
      {
        amount: data.amount, // Ensure amount is a number
        date: data.date, // Default date value
        description: data.description,
        url: data.url,
        type: "jpeg"
      }, // data
    );

    return response
  }

  async function addAttachmentImage(formFileData: FormData) {

    const { storage } = await createSessionClient();

    const result = await storage.createFile(
      "expenses", // Bucket ID
      ID.unique(), // File ID
      formFileData.get("file") as File
    );

    return result; // This will be the uploaded file's metadata
  }





  export async function getDepartments() {
    const { db } = await createSessionClient();
    const response = await db.listRows('app', 'departments', [
      Query.limit(1000)
    ]);

    return response.rows as Department[]
  }

  export async function getCampuses() {
    const { db } = await createSessionClient();
    const response = await db.listRows('app', 'campus', [
      Query.limit(100)
    ]);

    return response.rows as Campus[]
  }

