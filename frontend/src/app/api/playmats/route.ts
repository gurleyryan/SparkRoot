import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  // Find all playmat-texture*.svg files in public/
  const publicDir = path.join(process.cwd(), 'public');
  let files: string[] = [];
  try {
    files = fs.readdirSync(publicDir)
      .filter(f => /^playmat-texture.*\.svg$/i.test(f));
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to read public directory' }, { status: 500 });
  }
  return NextResponse.json({ success: true, files });
}
