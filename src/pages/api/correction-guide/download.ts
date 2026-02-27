import type { NextApiRequest, NextApiResponse } from "next";
import { downloadFile } from "~/lib/storage";

/**
 * 보정권고 안내사항 템플릿 파일 다운로드 API
 * GET /api/correction-guide/download?key=xxx
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key } = req.query;

  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "파일 키가 필요합니다" });
  }

  try {
    const buffer = await downloadFile(key);
    
    // 파일명 추출 (키에서 마지막 부분)
    const fileName = key.split("/").pop() ?? "download";
    
    // Content-Type 추론
    let contentType = "application/octet-stream";
    const ext = fileName.split(".").pop()?.toLowerCase();
    
    if (ext) {
      const mimeTypes: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        txt: "text/plain",
        csv: "text/csv",
      };
      contentType = mimeTypes[ext] ?? contentType;
    }

    // 응답 헤더 설정
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1년 캐시
    
    return res.send(buffer);
  } catch (error) {
    console.error("[Download] Error:", error);
    return res.status(404).json({ error: "파일을 찾을 수 없습니다" });
  }
}

// Next.js API 설정 - 큰 파일 처리를 위해 bodyParser 비활성화
export const config = {
  api: {
    responseLimit: false,
  },
};
