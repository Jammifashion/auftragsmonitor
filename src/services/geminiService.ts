import { GoogleGenAI, Type } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ZeroFrictionResponse {
  intent: "create" | "query";
  text_response: string;
  create_data: {
    type: "order" | "structure" | "callback";
    title: string;
    clientName?: string;
    description: string;
    deadline?: string;
    priority: "low" | "medium" | "high";
    structured_details: {
      kern_aufgabe: string;
      naechster_schritt: string;
      hintergrund_info: string | null;
    };
    duplicate_check: {
      is_potential_duplicate: boolean;
      reason: string;
      similarOrderId?: string;
    };
  } | null;
  client_data: {
    name: string;
    telefon: string | null;
    email: string | null;
    adresse: string | null;
    zahlungsinfo: string | null;
  } | null;
  query_data: {
    filter_client: string | null;
    query_type: "order" | "client";
    suggested_ui_action: "call" | "email" | "mark_done" | null;
  } | null;
}

export const zeroFrictionSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["create", "query"] },
    text_response: { type: Type.STRING, description: "Short friendly response text" },
    create_data: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        type: { type: Type.STRING, enum: ["order", "structure", "callback"] },
        title: { type: Type.STRING },
        clientName: { type: Type.STRING, nullable: true },
        description: { type: Type.STRING },
        deadline: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD" },
        priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
        structured_details: {
          type: Type.OBJECT,
          properties: {
            kern_aufgabe: { type: Type.STRING },
            naechster_schritt: { type: Type.STRING },
            hintergrund_info: { type: Type.STRING, nullable: true }
          },
          required: ["kern_aufgabe", "naechster_schritt"]
        },
        duplicate_check: {
          type: Type.OBJECT,
          properties: {
            is_potential_duplicate: { type: Type.BOOLEAN },
            reason: { type: Type.STRING, nullable: true },
            similarOrderId: { type: Type.STRING, nullable: true }
          },
          required: ["is_potential_duplicate"]
        }
      },
      required: ["type", "title", "description", "priority", "duplicate_check"]
    },
    client_data: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        name: { type: Type.STRING },
        telefon: { type: Type.STRING, nullable: true },
        email: { type: Type.STRING, nullable: true },
        adresse: { type: Type.STRING, nullable: true },
        zahlungsinfo: { type: Type.STRING, nullable: true }
      },
      required: ["name"]
    },
    query_data: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        filter_client: { type: Type.STRING, nullable: true },
        query_type: { type: Type.STRING, enum: ["order", "client"] },
        suggested_ui_action: { type: Type.STRING, enum: ["call", "email", "mark_done"], nullable: true }
      },
      required: ["query_type"]
    }
  },
  required: ["intent", "text_response"]
};


export async function mergeOrders(orders: any[]): Promise<any> {
    const model = "gemini-2.5-flash";
    const prompt = `
      Merge the following orders into one single, structured, and logical order for a business owner.
      Keep the most important information and combine descriptions if necessary.
      
      Orders to merge:
      ${JSON.stringify(orders)}
      
      Return a structured JSON object matching the create_data structure.
    `;
    const result = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(result.text);
  }
  
  export async function processUniversalInput(input: string, existingOrders: any[], clientCtx: string = ""): Promise<ZeroFrictionResponse> {
    const model = "gemini-2.5-flash";
    
    const ctx = existingOrders.map(o => `ID: ${o.id}, Title: ${o.title}, Client: ${o.clientName || ''}, Type: ${o.type}`).join('\n');
    const today = new Date().toISOString().split('T')[0];
  
    const prompt = `
      You are an expert assistant for a small business. Your primary language is German.
      IMPORTANT: Keep all German characters (Umlauts like ä, ö, ü, Ä, Ö, Ü, ß) EXACTLY as they are. Do not remove them or translate them to English alternatives. Ensure the output is valid JSON in German.

      Analyze the following vocal or text input and determine the user's intent. The user is a business owner managing an agency/company.
      Today's date is: ${today}.
  
      Input: "${input}"
  
      Existing database context (Orders):
      ${ctx}

      Existing database context (Clients/CRM):
      ${clientCtx}
      
      Instructions:
      1. Determine intent: 'create' for new entries, 'query' for finding information.
      2. If intent == 'create':
         - Fill 'create_data' with type, title, description, and priority.
         - 'duplicate_check': Search 'Existing database context (Orders)'. If a task with a very similar title OR identical clientName + similar goal exists, set is_potential_duplicate = true.
         - 'client_data': If phone numbers, emails, addresses, or payment info (PayPal etc) are mentioned, extract them.
         - 'clientName': Extract the name of the person/company. If mentioned in contact info, use that name.
      3. If intent == 'query':
         - If asking for contact details (numbers, mail) of a person, set query_type = 'client'.
         - If asking for tasks or filtered lists, set query_type = 'order'.
      
      Always return a valid JSON object matching the requested schema.
    `;
  
    const result = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zeroFrictionSchema,
      },
    });
  
    try {
      return JSON.parse(result.text);
    } catch (e) {
      console.error("Gemini Parse Error:", result.text);
      throw new Error("Invalid AI response format");
    }
  }
