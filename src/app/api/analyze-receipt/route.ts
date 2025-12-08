// src/app/api/analyze-receipt/route.ts

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// ✅ 1. 更新类别列表
const EXPENSE_CATEGORIES = [
    '飞机', '火车', '长途汽车', 'Taxi', 
    '过路费', // 新增
    '餐饮', '住宿', 
    '快递费', // 新增
    '电信费', // 新增
    '办公用品', '客户招待', '员工福利', '其他'
];

export async function POST(request: Request) {
  try {
    const { base64Image } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    // ✅ 2. 更新 Prompt 映射逻辑
    const prompt = `
      你是一个专业的财务会计助手。请精准分析这张中国发票/收据图片，提取以下 JSON 数据。
      
      请严格遵守以下提取规则：
      
      1. **amount**: 总金额（"价税合计"小写数字），数字，保留2位小数。
      2. **date**: 开票日期，格式 YYYY-MM-DD。
      3. **invoice_number**: 发票号码（8位或20位数字，绝不要提取发票代码）。
      4. **is_vat_special**: 布尔值。标题含"专用发票"返回 true，否则 false。
      5. **tax_rate**: 税率（数字）。如 6。
      
      6. **category**: 综合分析"货物名称"和"销售方"，从列表中选最匹配的一项：${JSON.stringify(EXPENSE_CATEGORIES)}。
         - **判定规则（优先级从高到低）**：
         - 含 "通行费"、"高速"、"ETC"、"路桥" $\rightarrow$ 选择 "**过路费**"。
         - 含 "快递"、"物流"、"运输服务*收派"、"顺丰"、"圆通"、"邮政" $\rightarrow$ 选择 "**快递费**"。
         - 含 "通信费"、"电信"、"移动"、"联通"、"话费"、"宽带" $\rightarrow$ 选择 "**电信费**"。
         - 含 "客运"、"滴滴"、"出行"、"出租"、"客运服务费" $\rightarrow$ 选择 "**Taxi**"。
         - 含 "餐饮"、"饮食" $\rightarrow$ 选择 "**餐饮**"。
         - 含 "住宿"、"酒店" $\rightarrow$ 选择 "**住宿**"。
         - 含 "机票"、"航空" $\rightarrow$ 选择 "**飞机**"。
         - 含 "火车"、"铁路" $\rightarrow$ 选择 "**火车**"。
         - 否则根据常识判断。
      
      请直接返回纯 JSON 格式数据，不要包含 Markdown 格式。
    `;

    const modelName = process.env.AI_MODEL_NAME || "qwen-vl-max";
    console.log(`[AI] Analyzing with model: ${modelName}`);

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: base64Image },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("AI 未返回内容");

    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let result;
    try {
        result = JSON.parse(cleanContent);
    } catch (e) {
        console.error("JSON Parse failed:", cleanContent);
        throw new Error("AI 返回格式错误");
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json({ error: error.message || '识别失败' }, { status: 500 });
  }
}