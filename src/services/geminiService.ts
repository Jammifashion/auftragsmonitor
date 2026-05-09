import { GoogleGenAI, Type } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface StructuredOrder {
  title: string;
  client: string;
  description: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export const orderSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short descriptive title" },
    client: { type: Type.STRING, description: "Client or customer name" },
    description: { type: Type.STRING, description: "Detailed task list or summary" },
    deadline: { type: Type.STRING, description: "ISO Date if mentioned, else undefined" },
    priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
    status: { type: Type.STRING, enum: ["pending", "in_progress", "completed", "cancelled"] },
  },
  required: ["title", "client", "description", "priority", "status"],
};

export async function parseOrderInput(input: string, currentContext?: string): Promise<StructuredOrder> {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze the following input and extract order/task details.
    Input: "${input}"
    
    Context (already existing orders): 
    ${currentContext || "None"}
    
    Return a structured JSON representing the new order. 
    If a similar order already exists, include a note in the description or try to match the client.
  `;

  const result = await genAI.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: orderSchema,
    },
  });

  return JSON.parse(result.text);
}

export async function checkForDuplicates(input: string, existingOrders: any[]): Promise<{ isDuplicate: boolean; similarOrderId?: string; reason?: string }> {
  const model = "gemini-3-flash-preview";
  const ordersSummary = existingOrders.map(o => `ID: ${o.id}, Title: ${o.title}, Client: ${o.client}`).join('\n');
  
  const prompt = `
    Check if the following new order description is a duplicate or very similar to existing orders.
    New Input: "${input}"
    
    Existing Orders:
    ${ordersSummary}
    
    Return a JSON object: { "isDuplicate": boolean, "similarOrderId": string | null, "reason": string }
  `;

  const result = await genAI.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isDuplicate: { type: Type.BOOLEAN },
          similarOrderId: { type: Type.STRING, nullable: true },
          reason: { type: Type.STRING }
        },
        required: ["isDuplicate", "reason"]
      }
    },
  });

  return JSON.parse(result.text);
}
