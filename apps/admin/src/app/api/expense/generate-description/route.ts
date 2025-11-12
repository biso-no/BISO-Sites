import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { descriptions, event } = await request.json();

    const response = await fetch('https://appwrite.biso.no/v1/functions/generateDescription/executions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any required Appwrite authentication headers here
        'X-Appwrite-Project': process.env.NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_PROJECT!,
        'X-Appwrite-Key': process.env.APPWRITE_API_KEY!,
      },
      body: JSON.stringify({
        descriptions,
        event
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate description');
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in generate-description:', error);
    return NextResponse.json(
      { error: 'Failed to generate description' },
      { status: 500 }
    );
  }
} 