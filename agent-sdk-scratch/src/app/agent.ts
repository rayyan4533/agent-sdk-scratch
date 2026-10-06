import { HARNESS_PROMPT } from "./config";
import OpenAi from "openai";
import dotenv from "dotenv";
dotenv.config();
export interface IMessage{
    role: "developer"|"system" | "user" | "assistant";
    content: string;
} 

export interface Itool{
    name: string;
    description: string;
    doc?: string;
    executor:(input:string)=>Promise<string>
}

export type Interceptor = (message:IMessage)=>void;

export class AgentBuilder {
    public instructions:string | undefined;
    public tools: Itool[] = [];

    constructor(){}

    public setInstructions(instructions:string){
        this.instructions = instructions;
        return this;
    }

    public addTool(tool:Itool){
        this.tools.push(tool);
        return this;
    }

    public build() {
        return new Agent(this)
    }

   
}



export class Agent{
    private instructions:string ;
    private messageHistory:IMessage[]
    private toolMap:Map<string, Itool>
    private MAX_LOOP:number = 10;
    private openai:OpenAi;
    private interceptors: Interceptor[];
    constructor(builder:AgentBuilder){
        this.openai = new OpenAi({
            apiKey: process.env.OPENAI_API_KEY
        })
        this.toolMap = new Map();
        this.interceptors = [];

        for(const t of builder.tools){
            this.toolMap.set(t.name, t);
        }
        this.instructions =
        `
        ${HARNESS_PROMPT}\n\n

        System Prompt: ${builder.instructions}

        Available Tools: ${builder.tools.map(t=>JSON.stringify(
                                                    {
                                                        functionName: t.name,
                                                        functionDescription: t.description,
                                                        functionDoc: t.doc
                                                    })).join(", ")}
        `

        this.messageHistory = []
    }

    public attachInterceptor(interceptor: Interceptor){
        this.interceptors.push(interceptor);
    }

    private notifyInterceptors(message:IMessage){
        for(const interceptor of this.interceptors){
            interceptor(message);
        }
    }
      static builder(){
        return new AgentBuilder();
    }

    public printSystemPrompt(){
        console.log(this.instructions);
    }
     public async run(query:string){
        // Implementation for running the agent with the given query

        //append user query to message history
        this.messageHistory.push({role:"user", content:query});
        for(let i=0;i<this.MAX_LOOP;i++){
            //call llm (system prompt + message history + query) 
            const llmResponse=await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {role:"system", content:this.instructions},
                    ...this.messageHistory.map(m=>({role:m.role, content:m.content}))
                ]
            });

            const rawLLMResponse = llmResponse.choices[0].message?.content as string;
                
            //append llm response to message history which can belong to any of the role (system, user, assistant)
            this.messageHistory.push({role:"assistant", content:rawLLMResponse });
            this.notifyInterceptors({role:"assistant", content:rawLLMResponse });
            //parse the llm response to json object
            const parsedLLMResponse = JSON.parse(rawLLMResponse);

            //if llmresponse.step===output then break and return the output
            if(parsedLLMResponse.step.toLowerCase() === "output"){
                return parsedLLMResponse.text;
            }

            //if llmresponse.step===tool_request
             if(parsedLLMResponse.step.toLowerCase() === "tool_request"){
                const {functionName, input} = parsedLLMResponse;

                const tool = this.toolMap.get(functionName);

                if(!tool){
                    this.messageHistory.push({role:"developer",content:`Tool ${functionName} not found`});
                    continue;
                }
           

                   //us llmresponse.functionName lo and toolMap.find(llmresponse.functionName)
            /*     toolResult = tool.executor(LLMResponse.input)
             *     Append toolResult to Message HISTORY
             *      continue
             */
                  const toolResult=await tool.executor(input)
                  this.messageHistory.push({role:"developer",
                     content:JSON.stringify({
                        functionName,
                        input,
                        toolResult
                     })
                     
                  });
                  this.notifyInterceptors({role:"developer",
                     content:JSON.stringify({
                        functionName,
                        input,
                        toolResult
                     })
            })


           
        }
    }   
}
}
