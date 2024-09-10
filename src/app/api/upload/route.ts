import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {client, model, uploadDir} from "@/lib/config";
import {BusinessIdea, BusinessIdeas, HeadResponse, Marp, MarpSlides, PageResponse, TopicAndAns} from "@/types/gptSchemas";


const fileToBase64 = async (file: File) => Buffer.from(await file.arrayBuffer()).toString('base64');

interface SlideInfo {
    company_name: string;
    topic: string;
}

const readSlideHead = async (files: File[], controller: ReadableStreamDefaultController): Promise<SlideInfo | null> => {
    controller.enqueue('Reading slide head...\n');
    const head_res = await client.beta.chat.completions.parse({
        model,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: `This image is the first page of the slide deck. Please provide the following information:
- Company Name: Identify the company that created this slide deck.
- Slide Content Description: Offer a brief overview of the main content or focus of the slides.` },
                    {
                        type: "image_url",
                        image_url: {
                            "url": `data:image/jpeg;base64,${await fileToBase64(files[0])}`,
                        },
                    },
                ],
            },
        ],
        response_format: zodResponseFormat(HeadResponse, 'headResponse'),
    });

    const head_message = head_res.choices[0]?.message;
    if (!head_message?.parsed) {
        controller.enqueue('Failed to parse slide head\n');
        return null;
    }

    controller.enqueue(`Company: ${head_message.parsed.company_name}, Description: ${head_message.parsed.description}\n`);

    return {
        company_name: head_message.parsed.company_name,
        topic: head_message.parsed.description,
    };
}

const readSlideBody = async (company_info: SlideInfo, files: File[], controller: ReadableStreamDefaultController) => {
    controller.enqueue('Reading slide body...\n');
    const description_per_page = [];

    for (let i = 1; i < files.length; i++) {
        controller.enqueue(`Processing slide ${i + 1}/${files.length}...\n`);
        const page_res = await client.beta.chat.completions.parse({
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: `This image represents slide ${i} out of ${files.length} from the presentation by ${company_info.company_name}. The slide focuses on the topic: ${company_info.topic}. Please extract and present the following information:
- Main Topic
- Body Text
- Visual Elements
- Summary` },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:image/jpeg;base64,${await fileToBase64(files[i])}`,
                            },
                        },
                    ],
                },
            ],
            response_format: zodResponseFormat(PageResponse, 'pageResponse'),
        });

        const page_message = page_res.choices[0]?.message;
        if (!page_message?.parsed) {
            controller.enqueue(`Failed to parse slide ${i + 1}\n`);
            return null;
        }
        description_per_page.push(page_message.parsed);
        controller.enqueue(`Slide ${i + 1} processed.\n`);
    }

    return description_per_page;
}

const getBestBusinessIdea = async (text: string, idea_condition: string, idea_n: number, controller: ReadableStreamDefaultController) => {
    controller.enqueue('Generating business ideas...\n');
    const idea_res = await client.beta.chat.completions.parse({
        model,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: `The following is the text of the slides.
${text}
Evaluate the assets of this company and come up with new ${idea_n} business ideas based on that evaluation and the following condition:
${idea_condition}` },
                ],
            },
        ],
        response_format: zodResponseFormat(BusinessIdeas, 'BusinessIdeas'),
    });

    const idea_message = idea_res.choices[0]?.message;
    if (!idea_message?.parsed) {
        controller.enqueue('Failed to generate business ideas\n');
        return null;
    }

    controller.enqueue(`Business ideas generated:\n${idea_message.parsed.businessIdeas.map((idea, i) => `Idea ${i + 1}: ${idea.main_idea}`).join('\n')}\n`);
    controller.enqueue(`Best business idea: ${idea_message.parsed.bestIdea.main_idea}\n`);
    return idea_message.parsed;
}

const refine = async (idea: z.infer<typeof BusinessIdea>, assetVal: string, controller: ReadableStreamDefaultController) => {
    controller.enqueue('Refining business idea...\n');

    const idea_topics = {
        "Essence of Business Idea": [
            "Detailed description of the product/service offered",
            "Clarification of the Unique Selling Proposition (USP)",
            "Long-term vision and social impact of the business"
        ],
        "Market Analysis and Customer Understanding": [
            "Detailed profiling of the target customer segment",
            "In-depth analysis of customer issues and pain points",
            "Quantitative evaluation of market size, growth potential, and trends"
        ],
        "Competitive Analysis and Differentiation Strategy": [
            "Identification and detailed analysis of key competitors (strengths, weaknesses)",
            "Clarification of the company's differentiation points",
            "Establishment and maintenance of competitive advantage"
        ],
        "Business Model Design": [
            "Detailed design of revenue structure (consideration of multiple revenue streams)",
            "Analysis of cost structure (fixed costs, variable costs, initial investment)",
            "Pricing strategy and its rationale",
            "Methodology for scaling up"
        ],
        "Marketing and Sales Strategy": [
            "Brand positioning and branding strategy",
            "Multifaceted consideration of customer acquisition channels",
            "Specific plan for promotional methods",
            "Formulation of customer retention strategy"
        ],
        "Product/Service Development": [
            "Detailed list of key features and characteristics",
            "Development schedule and key milestones",
            "Identification of necessary technologies and resources",
            "Design of quality control and improvement processes"
        ],
        "Operations and Supply Chain": [
            "Design of key business processes",
            "Supply chain optimization plan",
            "Methods for leveraging partnerships and external resources",
            "Consideration of technology implementation for operational efficiency"
        ],
        "Financial Planning and Fundraising": [
            "Detailed income and expenditure forecast and break-even analysis",
            "Estimation of initial investment and working capital",
            "Methods and plans for fundraising (self-funding, investors, loans, etc.)",
            "Analysis and countermeasures for financial risks"
        ],
        "Risk Management and Legal Considerations": [
            "Comprehensive identification and classification of potential risks",
            "Formulation of risk mitigation measures and contingency plans",
            "Confirmation of necessary permits and licenses",
            "Analysis of the impact of laws and regulations (intellectual property, labor law, consumer protection, etc.)"
        ],
        "Organization and Human Resource Planning": [
            "Identification of necessary skill sets and personnel",
            "Design of organizational structure and role distribution",
            "Strategy for talent acquisition and development",
            "Plan for building corporate culture"
        ],
        "Technology and Innovation": [
            "Identification of necessary technological infrastructure",
            "Planning of research and development",
            "Creation of mechanisms to promote innovation",
            "Strategies for responding to technological trends"
        ],
        "Growth Strategy and Exit Strategy": [
            "Setting specific business goals for the next 3-5 years",
            "Planning for market expansion or entry into new markets",
            "Consideration of diversification or vertical integration possibilities",
            "Examination of long-term exit strategies (IPO, M&A, etc.)"
        ]
    };

    let detailed_idea = { ...idea };
    let topic_and_ans: z.infer<typeof TopicAndAns>[] = [];

    for (const [category, topics] of Object.entries(idea_topics)) {
        controller.enqueue(`Refining ${category}...\n`);

        const topics_string = topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n');

        const refine_res = await client.chat.completions.create({
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: `We are currently analyzing a **fixed business idea**:
Main Idea: ${detailed_idea.main_idea}
Strengths: ${detailed_idea.strengths}
Weaknesses: ${detailed_idea.weaknesses}
Opportunities: ${detailed_idea.opportunities}
Threats: ${detailed_idea.threats}

The business idea is based on the following asset valuation:
${assetVal}

In this category, we will focus on the following topics:
${topics_string}


You are working for top business consultant firm.
Please provide detailed answers and insights for each topic in the category: ${category}.
Answers must be detailed and specific to the business idea.
Detailed and specific answers may include numerical data, examples, and explanations.
` },
                    ],
                },
            ],
        });

        const message = refine_res.choices[0]?.message;
        if (!message?.content) {
            controller.enqueue(`Failed to refine ${category}\n`);
            return null;
        }

        topic_and_ans.push({ category: category, answer: message.content });
        controller.enqueue(`Refined ${category} successfully\n`);
    }

    return topic_and_ans;
}

const createMarpText = async (
    idea: z.infer<typeof BusinessIdea>,
    topic_and_ans: z.infer<typeof TopicAndAns>[],
    controller: ReadableStreamDefaultController
) => {
    controller.enqueue('Creating Marp text...\n');

    // スライドの冒頭に含めるMarpのメタデータ
    const marpHeader = `---
marp: true
title: ビジネス企画書
theme: default
style: |
  section {
    font-size: 22px;
  }
---

`;

    // 目次を生成
    const toc = topic_and_ans.map((topic, index) => `${index + 1}. ${topic.category}`).join("\n");

    // 各スライドを非同期で生成
    const slides = await Promise.all(
        topic_and_ans.map(async (topic) => {
            try {
                const refine_res = await client.beta.chat.completions.parse({
                    model,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `以下の内容は、ビジネス企画書の **${topic.category}** に関する詳細な情報です。
${topic.answer}

この内容を元に、ビジネス企画書の **${idea.main_idea}** に関するスライドのページを1, 2枚作成してください。
情報を適切にまとめ、Marp形式かつ日本語で作成してください。
ただし、具体性が損なわれないようにして下さい。
`,
                                },
                            ],
                        },
                    ],
                    response_format: zodResponseFormat(MarpSlides, 'MarpSlides'),
                });
                const slide = refine_res.choices[0]?.message.parsed;
                if (!slide) {
                    controller.enqueue(`Failed to create slide for ${topic.category}\n`);
                    return '';
                }
                return slide.slides
                    .map(
                        (slide) => `# ${slide.title}\n${slide.content}`
                    )
                    .join("\n\n");
            } catch (error) {
                controller.enqueue(`Error creating slide for ${topic.category}: ${error}\n`);
                return '';
            }
        })
    );

    // 最終的なMarpテキストを結合して生成
    const marp = `${marpHeader}

## 目次
${toc}

---

${slides.join("\n---\n")}`;

    controller.enqueue('Marp text created successfully\n');

    const refinedMarpRes = await client.beta.chat.completions.parse({
        model,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: `以下のMarp形式の事業企画書を、よりスライドとして適切なMarp形式にして下さい。

${marp}

以下の指示に従って、Marp形式の**テキストのみ**を出力してください。コードブロックなどは不要です。
1. 具体性を保つ
2. 文字が途切れないようにする（4つ以上の箇条書きや、テキストが長い場合は次のページに分割する）
3. 自然な日本語にする
4. 目次とスライドの内容が一致させる
` },
                ]
            },
        ],
        response_format: zodResponseFormat(Marp, 'Marp'),
    });
    // console.log(marp);
    // console.log("-----------------");
    const refinedMarp = refinedMarpRes.choices[0]?.message.parsed;
    if (!refinedMarp) {
        controller.enqueue('Failed to refine Marp text\n');
        return null;
    }
    return refinedMarp.markdown;
};


export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const conditionText = formData.get('text') as string;

    await fs.mkdir(uploadDir, { recursive: true });

    const files: File[] = [];
    formData.forEach((value, key) => {
        if (key.startsWith('file_')) {
            files.push(value as File);
        }
    });

    if (files.length === 0) {
        return NextResponse.json({ message: 'No files uploaded' }, { status: 400 });
    }

    const readableStream = new ReadableStream({
        async start(controller) {
            try {
                const company_info = await readSlideHead(files, controller);
                if (!company_info) throw new Error('Failed to read slide head');

                const description_per_page = await readSlideBody(company_info, files, controller);
                if (!description_per_page) throw new Error('Failed to read slide body');

                let slideText = `Company Name: ${company_info.company_name}\nDescription: ${company_info.topic}\n`;
                slideText += description_per_page.map((page, index) => {
                    return `Slide ${index + 1}/${description_per_page.length}\nMain Topic: ${page.main_topic}\nBody: ${page.body}\nVisual Elements: ${page.visual_elements.join(', ')}\nSummary: ${page.summary}\n`;
                }).join('\n');

                await fs.writeFile(path.join(uploadDir, 'text.txt'), slideText);
                // const slideText = await fs.readFile(path.join(uploadDir, 'text.txt'), 'utf-8');
                controller.enqueue('Slides read successfully\n');

                const ideas = await getBestBusinessIdea(slideText, conditionText, 3, controller);
                if (!ideas) throw new Error('Failed to generate business ideas');

                const refinedIdea = await refine(ideas.bestIdea, ideas.assetValuation, controller);
                if (!refinedIdea) throw new Error('Failed to refine the idea');

                const marp = await createMarpText(ideas.bestIdea, refinedIdea, controller);
                if (!marp) throw new Error('Failed to create Marp text');
                await fs.writeFile(path.join(uploadDir, 'marp.md'), marp);

                controller.enqueue('Processing complete.\n');
                controller.enqueue(marp);

            } catch (error) {
                controller.enqueue(`Error: ${error}\n`);
            } finally {
                controller.close();
            }
        }
    });

    return new NextResponse(readableStream);
}
