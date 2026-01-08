import { NextResponse } from "next/server";

const GPTS_API_URL = "https://api.gptsapi.net/v1/chat/completions";
const GPTS_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = body.image;

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const response = await fetch(GPTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPTS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "你是一個專為香港人設計的專業翻譯引擎。任務：1. 提取圖片所有文字。2. 轉換為地道香港繁體中文（書面語）。嚴格規則：絕對禁止保留日文漢字（如「庁舎」譯為「大樓」）。徹底清除日文助詞（禁止出現 から、まで、ため、の）。保留餐牌價格格式。將日本年號轉換為西元。使用香港術語（如：本日推介、拼盤、未連稅）。"
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error("Upstream API error");
    }

    const data = await response.json();
    const translatedText = data?.choices?.[0]?.message?.content?.trim() || "無法辨識圖片文字";

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error("Translate API error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
