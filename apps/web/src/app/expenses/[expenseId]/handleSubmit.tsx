
import { addAttachmentImage, addExpenseAttachment, addExpense, updateExpense } from "@/app/actions/admin";
import { getUser } from "@/lib/admin/db";
import { getLoggedInUser } from "@/lib/actions/user";
export async function handleSubmit(formData, updateFormData, expenseId) {
  try {
    console.log("Starting file upload and expense submission...");

    // Step 1: Validate the attachments
    if (
      !Array.isArray(formData.expense_attachments) ||
      formData.expense_attachments.length === 0
    ) {
      throw new Error("No attachments found in the form data.");
    }

    const uploadedIds = []; // To store IDs of uploaded attachments

    // Step 2: Upload files and save attachment data
    const uploadPromises = formData.expense_attachments.map(async (attachment) => {
      if(!attachment?.url){
        const file = attachment?.image;

        // Validate file
        if (!file || !(file instanceof File)) {
          console.warn("Skipping invalid file:", attachment);
          return null; // Skip invalid files
        }
  
        // Upload the file to Appwrite Storage
        const formFileData = new FormData()
        formFileData.append("file",file)
        const uploadedImage = await addAttachmentImage(formFileData);
        console.log("File uploaded successfully. File ID:", uploadedImage.$id);
  
        // Prepare the metadata for the uploaded attachment
        const attachmentData = {
          amount: attachment.amount, // Ensure it's a valid number
          date: new Date().toISOString(), // Current date as ISO string
          description: attachment.description || "No description",
          url: `https://appwrite.biso.no/v1/storage/buckets/expenses/files/${uploadedImage.$id}/view?project=biso`,
          type: uploadedImage.mimeType || "unknown",
        };
  
        // Save attachment data to the database
        const savedAttachment = await addExpenseAttachment(attachmentData);
        uploadedIds.push(savedAttachment.$id); // Add attachment ID to the array
        console.log("Attachment saved successfully. Document ID:", savedAttachment.$id);
      }
      else{
        uploadedIds.push(attachment.$id);
      }

    });

    // Wait for all uploads and database operations to complete
    await Promise.all(uploadPromises);

    console.log("All attachments uploaded and saved successfully.");

    // Step 3: Update form data with uploaded attachment IDs
    updateFormData({ expense_attachments_ids: uploadedIds });

    // Step 4: Create the final expense entry in the database
    const expenseData = {
      campus:formData.campus,
      department:formData.department,
      bank_account:formData.bank_account,
      description:formData.description,
      total:formData.total,
      prepayment_amount:formData.prepayment_amount, 
      user:"6737a8090020d4b71e99",
      userId:"6737a8090020d4b71e99",
            //user:(await getLoggedInUser()).user.$id,
            //userId:(await getLoggedInUser()).user.$id,
      expense_attachments_ids: uploadedIds, // Add attachment IDs
    };

    console.log(expenseId.expenseId.expenseId)
    if(expenseId.expenseId.expenseId=="new"){
      console.log("trying to make a new entry")
      const expense = await addExpense(expenseData);
      console.log("Expense created successfully:", expense);
      return expense; // Optionally return the created expense data
    }

    console.log("just modifying an entry")
    const expense = await updateExpense(expenseId.expenseId.expenseId,expenseData);
    console.log("Expense updated successfully:", expense);
    return expense; // Optionally return the created expense data






  } catch (error) {
    console.error("Error during file upload and expense submission:", error);
    throw error; // Propagate the error for handling in the UI
  }
}
