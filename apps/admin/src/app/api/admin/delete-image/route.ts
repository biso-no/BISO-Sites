import { deleteImage } from "@/app/actions/media";

export async function POST(request: Request) {
  try {
    const { fileId } = await request.json();
    
    if (!fileId) {
      return Response.json(
        { success: false, error: "File ID required" },
        { status: 400 }
      );
    }
    
    const result = await deleteImage(fileId);
    return Response.json(result);
  } catch (error) {
    console.error("Delete API error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

