import { uploadImage } from "@/app/actions/media";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await uploadImage(formData);
    
    return Response.json(result);
  } catch (error) {
    console.error("Upload API error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

