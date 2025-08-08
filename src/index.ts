#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import * as readline from 'readline';

interface NpmPackage {
  name: string;
  description: string;
  "dist-tags": { latest: string };
  versions: { [key: string]: { dependencies: Record<string, string> } };
  author: { name: string } | string;
  homepage: string;
  repository: { url: string };
}

interface SearchResponse {
  objects: Array<{
    package: {
      name: string;
      description: string;
      version: string;
    };
  }>;
}

// Criar o servidor MCP
const server = new McpServer({
  name: "NpmSearchServer",
  version: "1.0.0"
});

// Adicionar ferramenta para buscar informações de pacotes npm
server.tool(
  "searchNpmPackage",
  { packageName: z.string() },
  async ({ packageName }) => {
    try {
      console.log(`\nBuscando informações para o pacote: ${packageName}`);
      const response = await fetch(`https://registry.npmjs.org/${packageName}`);
      const data = (await response.json()) as NpmPackage;
      
      if (response.ok) {
        const result = {
          name: data.name,
          version: data["dist-tags"].latest,
          description: data.description,
          author: typeof data.author === 'string' ? data.author : data.author?.name,
          homepage: data.homepage,
          repository: data.repository?.url,
          dependencies: data.versions[data["dist-tags"].latest].dependencies
        };

        console.log('\nInformações do pacote:');
        console.log('-------------------');
        Object.entries(result).forEach(([key, value]) => {
          if (key === 'dependencies') {
            console.log('\nDependências:');
            console.log(JSON.stringify(value, null, 2));
          } else {
            console.log(`${key}: ${value}`);
          }
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } else {
        const errorMsg = `Erro: Pacote '${packageName}' não encontrado`;
        console.log(`\n${errorMsg}`);
        return {
          content: [{
            type: "text",
            text: errorMsg
          }]
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const errorMsg = `Erro ao buscar informações do pacote: ${errorMessage}`;
      console.log(`\n${errorMsg}`);
      return {
        content: [{
          type: "text",
          text: errorMsg
        }]
      };
    }
  }
);

// Adicionar recurso para listar pacotes populares
server.resource(
  "popular-packages",
  new ResourceTemplate("npm://popular", { list: undefined }),
  async (uri) => {
    try {
      const response = await fetch("https://registry.npmjs.org/-/v1/search?text=popularity&size=10");
      const data = (await response.json()) as SearchResponse;
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(data.objects.map(obj => ({
            name: obj.package.name,
            description: obj.package.description,
            version: obj.package.version
          })), null, 2)
        }]
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        contents: [{
          uri: uri.href,
          text: `Erro ao buscar pacotes populares: ${errorMessage}`
        }]
      };
    }
  }
);

console.log('\nServidor NPM iniciado!');
console.log('Para buscar informações de um pacote, use: packageName = "nome-do-pacote"');
console.log('Exemplo: packageName = "react-dom"\n');

// Iniciar o servidor
const transport = new StdioServerTransport();
void server.connect(transport);

// Função para buscar informações do pacote
async function searchNpmPackage(packageName: string): Promise<void> {
  try {
    console.log(`\nBuscando informações para o pacote: ${packageName}`);
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json() as NpmPackage;
    
    if (response.ok) {
      console.log('\nInformações do pacote:');
      console.log('-------------------');
      console.log(`Nome: ${data.name}`);
      console.log(`Versão: ${data["dist-tags"].latest}`);
      console.log(`Descrição: ${data.description}`);
      console.log(`Autor: ${typeof data.author === 'string' ? data.author : data.author?.name}`);
      console.log(`Homepage: ${data.homepage}`);
      console.log(`Repositório: ${data.repository?.url}`);
      console.log('\nDependências:');
      console.log(JSON.stringify(data.versions[data["dist-tags"].latest].dependencies, null, 2));
    } else {
      console.log(`\nErro: Pacote '${packageName}' não encontrado`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.log(`\nErro ao buscar informações do pacote: ${errorMessage}`);
  }
}

// Criar interface de linha de comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função principal para interação com o usuário
function startCLI() {
  console.log('\nBem-vindo ao NPM Package Info!');
  console.log('Digite o nome do pacote para buscar informações ou "sair" para encerrar\n');

  function askPackage() {
    rl.question('Nome do pacote: ', async (input) => {
      if (input.toLowerCase() === 'sair') {
        console.log('\nAté logo!');
        rl.close();
        process.exit(0);
      }

      await searchNpmPackage(input);
      console.log('\n-------------------');
      askPackage();
    });
  }

  askPackage();
}

// Iniciar o programa
startCLI(); 