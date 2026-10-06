import axios from "axios";
import { Agent } from "./app/agent";
import type { Itool } from "./app/agent";
import { exec } from "child_process";

const weatherTool: Itool = {
    name: 'fetchWeatherInfo',
    description: 'Fetches realtime weather data by cityname',
    doc: 'fetchWeatherInfo(cityName: string): WeatherReport',
    async executor(cityName) {
         const url = `https://wttr.in/${cityName.toLowerCase()}?format=%C+%t`;
        const response = await axios.get(url, { responseType: 'text' });
        return JSON.stringify({ cityName, weatherInfo: response.data });
    },
}


const cliAccessTool: Itool = {
    name: 'execCli',
    description: 'Runs a CLI command on users machine and returns output',
    doc: 'execCli(cli: string): CLIResponse',
    executor(cmd) {
        return new Promise((res, rej) => {
            exec(cmd, (err, out) => {
                if (err) return res(`There was an Error ${err}`);
                else return res(out);
            });
        });
    }
}

async function init(){
    const agent:Agent = Agent.builder()
    .setInstructions("You are a helpful assistant that translates English to French.")
    .addTool(weatherTool)
    .build()

    agent.attachInterceptor((message)=>{
        console.log(`Interceptor: ${message.role}: ${message.content}`);
    });
    const result=await agent.run("What is the weather in Goa? and mumbai");
    console.log("Agent run completed"+result);
}

init().catch(console.error);
