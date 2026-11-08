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
    // 诚实边界：当前部署没有任何持久化层（Serverless 只读文件系统、未配置数据库）。
    // 原来返回 success:true 会让提交者以为报名已保存，实际邮箱被直接丢弃。
    // 改为明确标注 stored:false，并给出始终可达的替代渠道。
    return NextResponse.json({
      success: false,
      stored: false,
      reason: "no_persistence_configured",
      message:
        "No submission was stored: this deployment has no database configured. Please use the contact page or open a GitHub issue instead, and do not treat this endpoint as a signup.",
      alternatives: {
        contactPage: "/legal/contact",
        issues: "https://github.com/Tigerking-tech/Historia-globe/issues/new",
      },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
