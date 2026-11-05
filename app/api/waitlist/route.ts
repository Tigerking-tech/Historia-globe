import { NextResponse } from "next/server";

export interface WaitlistRequest {
  name: string;
  email: string;
  company?: string;
  message?: string;
}

// Lightweight contact/waitlist endpoint. The marketing contact form posts here.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WaitlistRequest;
    // In production, persist the lead or forward it to your CRM/email.
    return NextResponse.json({ success: true, received: body.email });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
