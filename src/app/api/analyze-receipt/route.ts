// src/app/api/analyze-receipt/route.ts

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const EXPENSE_CATEGORIES = ['飞机', '火车', '长途汽车', 'Taxi', '餐饮', '住宿', '办公用品', '客户招待', '员工福利', '其他'];

export async function POST(request: Request) {
  try {
    const { base64Image } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });
    }

    // 初始化 OpenAI 客户端 (实际连接的是阿里云 DashScope)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const prompt = `
      你是一个专业的财务会计助手。请精准分析这张中国发票/收据图片，提取以下 JSON 数据。
      
      请严格遵守以下提取规则：
      
      1. **amount**: 总金额（"价税合计"小写数字），数字，保留2位小数。
      2. **date**: 开票日期，格式 YYYY-MM-DD。
      
      3. **invoice_number**: 发票号码。
         - ⚠️ 必须区分"发票代码"和"发票号码"。
         - 发票号码通常是 8 位或 20 位数字（位于右上角）。
         - 绝对不要提取 10 位或 12 位的发票代码。
      
      4. **is_vat_special**: 布尔值 (true/false)。
         - 检查发票标题。只有包含"专用发票"字样时返回 true。
         - "增值税普通发票"、"电子发票"等均返回 false。
      
      5. **tax_rate**: 税率（数字）。例如 6 代表 6%。如果没有显示则返回 null。
      
      6. **category**: 综合分析"货物或应税劳务名称"和"销售方名称"，从列表中选最匹配的一项：${JSON.stringify(EXPENSE_CATEGORIES)}。
         - **判定规则（优先级从高到低）**：
         - 若包含 "客运服务费"、"运输服务"、"车辆通行费"、"滴滴"、"曹操出行"、"T3"、"出租" $\rightarrow$ 选择 "**Taxi**"。
         - 若包含 "餐饮服务"、"饮食" $\rightarrow$ 选择 "**餐饮**"。
         - 若包含 "住宿费"、"酒店"、"宾馆" $\rightarrow$ 选择 "**住宿**"。
         - 若包含 "机票"、"航空运输" $\rightarrow$ 选择 "**飞机**"。
         - 若包含 "火车票"、"铁路" $\rightarrow$ 选择 "**火车**"。
         - 否则根据常识判断。
      
      请直接返回纯 JSON 格式数据，不要包含 Markdown 格式 (如 \`\`\`json ... \`\`\`)。
    `;

    // 使用环境变量里的 qwen-vl-max
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
              image_url: {
                // 阿里云要求 base64 格式必须包含前缀，前端传来的已有前缀，直接用
                url: base64Image, 
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      throw new Error("AI 未返回内容");
    }

    // 清理 Markdown 标记
    const cleanContent = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
    
    // 尝试解析 JSON
    let result;
    try {
        result = JSON.parse(cleanContent);
    } catch (e) {
        console.error("JSON Parse failed:", cleanContent);
        throw new Error("AI 返回格式错误");
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Qwen Analysis Error:', error);
    return NextResponse.json({ 
        error: error.message || '识别失败，请检查网络或Key' 
    }, { status: 500 });
  }
}