import { z } from 'zod';

export const HeadResponse = z.object({
    company_name: z.string(),
    description: z.string(),
});

export const PageResponse = z.object({
    main_topic: z.string(),
    body: z.string(),
    visual_elements: z.array(z.string()),
    summary: z.string(),
});

export const BusinessIdea = z.object({
    main_idea: z.string(),
    strengths: z.string(),
    weaknesses: z.string(),
    opportunities: z.string(),
    threats: z.string(),
});

export const BusinessIdeas = z.object({
    assetValuation: z.string(),
    businessIdeas: z.array(BusinessIdea),
    bestIdea: BusinessIdea
});

export const BusinessPlan = z.object({
    purpose: z.string(),
    background: z.string(),
    market: z.string(),
    competition: z.string(),
    product: z.string(),
    marketing: z.string(),
    financials: z.string(),
    risks: z.string(),
    conclusion: z.string(),
});

export const FinalizedBusinessIdea = z.object({
    idea: BusinessIdea,
    plan: BusinessPlan,
});

export const TopicAndAns = z.object({
    category: z.string(),
    answer: z.string(),
});

export const MarpSlide = z.object({
    title: z.string(),
    content: z.string(),
});

export const MarpSlides = z.object({
    slides: z.array(MarpSlide),
});

export const Marp = z.object({
    markdown: z.string(),
});