import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {execSync} from "node:child_process";
import {uploadDir} from "@/lib/config";


export async function GET() {
    const tempMarkdownPath = path.join(uploadDir, 'marp.md');
    const tempPdfPath = path.join(uploadDir, 'slide.pdf');

    try {
        // Marp CLIを使用してMarkdownからPDFを生成
        execSync(`marp ${tempMarkdownPath} -o ${tempPdfPath}`);

        // 生成されたPDFを読み込み
        const pdfBuffer = fs.readFileSync(tempPdfPath);

        // 一時ファイルを削除
        fs.unlinkSync(tempPdfPath);

        // PDFをレスポンスとして送信
        const response = new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename=slide.pdf',
            },
        });

        return response;
    } catch (error) {
        console.error('Error generating PDF:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}