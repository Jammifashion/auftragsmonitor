import { GoogleGenAI, Type } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ZeroFrictionResponse {
  intent: "create" | "query" | "crm_update" | "delete_record" | "merge_clients" | "mark_completed";
  text_response: string;
  create_data: {
    type: "order" | "aufgabe" | "idee" | "callback";
    title: string;
    clientName?: string;
    projectName?: string;
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
  }[] | null;
  client_data: {
    name: string;
    telefon: string | null;
    email: string | null;
    adresse: string | null;
    zahlungsinfo: string | null;
  } | null;
  project_data: {
    name: string;
    description: string | null;
  } | null;
  query_data: {
    filter_client: string | null;
    query_type: "order" | "client";
    suggested_ui_action: "call" | "email" | "mark_done" | null;
  } | null;
  action_data: {
    target_type: "order" | "client";
    primary_name: string;
    secondary_name?: string;
  } | null;
}

export const zeroFrictionSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["create", "query", "crm_update", "delete_record", "merge_clients", "mark_completed"] },
    text_response: { type: Type.STRING, description: "Short friendly response text" },
    create_data: {
      type: Type.ARRAY,
      nullable: true,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["order", "aufgabe", "idee", "callback"] },
          title: { type: Type.STRING },
          clientName: { type: Type.STRING, nullable: true },
          projectName: { type: Type.STRING, nullable: true },
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
      }
    },
    client_data: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        name: { type: Type.STRING },
        telefon: { type: Type.STRING, nullable: true },
        email: { type: Type.STRING, nullable: true },
        adresse: { type: Type.STRING, nullable: true },
        zahlungsinfo: { type: Type.STRING, nullable: true },
        insights: { type: Type.STRING, nullable: true, description: "Stimmungs-Radar / Client Insights" }
      },
      required: ["name"]
    },
    project_data: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING, nullable: true }
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
    },
    action_data: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        target_type: { type: Type.STRING, enum: ["order", "client"] },
        primary_name: { type: Type.STRING },
        secondary_name: { type: Type.STRING, nullable: true }
      },
      required: ["target_type", "primary_name"]
    }
  },
  required: ["intent", "text_response"]
};


export async function mergeOrders(orders: any[]): Promise<any> {
    const prompt = `
      Merge the following orders into one single, structured, and logical order for a business owner.
      Keep the most important information and combine descriptions if necessary.
      
      Orders to merge:
      ${JSON.stringify(orders)}
      
      Return a structured JSON object matching the create_data structure.
    `;
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "{}");
  }
  
  export async function processUniversalInput(input: string, existingOrders: any[], clientCtx: string = "", projectCtx: string = "", userSettings?: any): Promise<ZeroFrictionResponse> {
    const ctx = existingOrders.map(o => `ID: ${o.id}, Title: ${o.title}, Client: ${o.clientName || ''}, Project: ${o.projectName || ''}, Type: ${o.type}`).join('\n');
    const today = new Date().toISOString().split('T')[0];

    const toneOfVoice = userSettings?.toneOfVoice || "business";
    const defaultDeadline = userSettings?.defaultDeadline || "7";

    let specificToneInstructions = "Antworte professionell und geschäftlich.";
    if (toneOfVoice === "business") {
       specificToneInstructions = "Antworte professionell, höflich und strikt geschäftlich.";
    } else if (toneOfVoice === "short") {
       specificToneInstructions = "Antworte extrem kurz, knackig und direkt. Keine Füllwörter.";
    } else if (toneOfVoice === "humorous") {
       specificToneInstructions = "Antworte locker, humorvoll und mit einem leichten Augenzwinkern.";
    }

    let deadlineInstructions = "";
    if (defaultDeadline !== "none") {
        deadlineInstructions = `Wenn der Nutzer keine spezifische Zeit oder Frist (Deadline) nennt, setze die 'deadline' standardmäßig auf exakt in ${defaultDeadline} Tagen von heute.`;
    }
  
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
      
      Existing database context (Projects):
      ${projectCtx}
      
      Instructions:
      1. Determine intent: 
         - 'create' for new actionable tasks (order, aufgabe, idee, callback).
         - 'aufgabe': For explicit tasks or scheduled to-dos that have a deadline or need to be done.
         - 'idee': for unstructured tasks, ideas, internal notes, or things you cannot clearly assign.
         - 'query' for finding information.
         - 'crm_update' for pure customer data updates (phone, email, address) without creating a task.
         - 'delete_record' to delete an order or client.
         - 'mark_completed' to mark a task/order as done.
         - 'merge_clients' to merge two clients or aliases.

      2. ALIAS-REGEL (Identitäts-Verknüpfung):
         - Wenn ein Name (z.B. Timo Schenck) UND ein Projektname/Firma (z.B. Malle Prinz) genannt werden, verknüpfe sie im Feld 'clientName' zwingend als: "Name (Alias/Projekt)". Beispiel: "Timo Schenck (Malle Prinz)".
         - Nutze das 'client_data'-Objekt, um den Hauptnamen (ohne Klammern) zu identifizieren. Falls ein Alias/Projektname ("Arenal Asozial") existiert, füge diesen in den Kontext ein.
         - WICHTIG: Wenn der Nutzer einen Namen nennt, der fast identisch mit einem bestehenden Kunden oder dessen Alias ist (z.B. "Tim Gestrin" statt "Tim Gestring"), verwende den EXAKTEN Namen aus dem Datenbank-Kontext, um Duplikate zu vermeiden.

      3. SILENT-UPDATE-REGEL (Reines CRM-Update):
         Wenn die Eingabe ausschließlich der Aktualisierung von Kundendaten dient (neue Telefonnummer, Adresse, etc), setze intent = 'crm_update' und befüllen nur das 'client_data'-Objekt. Es darf KEIN 'create_data' erstellt werden.
      
      4. Wenn intent == 'delete_record' oder 'merge_clients':
         - Befülle 'action_data' mit 'target_type' ("order" oder "client"), 'primary_name', und ggf. 'secondary_name'.

      5. Wenn intent == 'create' oder 'crm_update':
         - Fill 'create_data' (nur bei 'create') as an ARRAY of tasks/orders. Wenn der Nutzer mehrere Aufgaben auf einmal nennt, erstelle mehrere Objekte in diesem Array.
         - 'duplicate_check' (nur bei 'create'): Search 'Existing database context (Orders)'. If a task with a very similar title OR identical clientName + similar goal exists, set is_potential_duplicate = true.
         - 'client_data': Extract contact info if mentioned. Extract ANY subjective feelings, warnings, or mood indicators about the client into 'insights' (Stimmungs-Radar).
         - 'project_data': Extract project master data if a project (e.g. app development) is mentioned for the first time.
         - 'clientName': Extract the name, conforming to the ALIAS-REGEL if applicable.
         - 'projectName': Extract the project name if the task belongs to a specific project.
         - ${deadlineInstructions}
      
      6. Wenn intent == 'query':
         - If asking for contact details of a person, set query_type = 'client'.
         - If asking for tasks or filtered lists, set query_type = 'order'.
         - When responding with list of orders, ALWAYS check the "Existing database context (Orders)" and reference specific orders as [Auftrag: TITLE] in your text_response, so the user can easily identify them.

      7. Tone of Voice:
         - Für das Feld 'text_response': ${specificToneInstructions}
         - Include actionable insight in 'text_response'. If there are pending tasks, call them out.
         
      Always return a valid JSON object matching the requested schema.
    `;
  
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zeroFrictionSchema,
      }
    });
  
    try {
      return JSON.parse(response.text || "{}");
    } catch (e) {
      console.error("Gemini Parse Error:", response.text);
      throw new Error("Invalid AI response format");
    }
  }
