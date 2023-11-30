import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAI } from "langchain/llms/openai";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";
import { timeout } from "./config";
import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";

export const createPineconeIndex = async (
  client: Pinecone,
  indexName: string,
  vectorDimension: number
) => {
  // 1. Initiate index existece check
  console.log(`Checking "${indexName}"...`);

  // 2. Get list of existing indexes
  const existingIndexes = (await client.listIndexes()).map(
    (index) => index.name
  );

  console.log(
    "indexName: ",
    indexName,
    "ExistingIndexes: ",
    existingIndexes.join(",")
  );

  if (!existingIndexes.includes(indexName)) {
    // 4. Log index creation initiation
    console.log(`Creating "${indexName}"...`);

    // 5. Create index
    await client.createIndex({
      name: indexName,
      dimension: vectorDimension,
      metric: "cosine",
    });

    // 6. Log successful creation
    console.log(`Creating index... please wait for it to finish initializing.`);
    // 7. Wait for index initialization
    await new Promise((resolve) => setTimeout(resolve, timeout));
  } else {
    // 8. Log if index already exists
    console.log(`"${indexName}" already exists.`);
  }
};

export const updatePinecone = async (
  client: Pinecone,
  indexName: string,
  docs
) => {
  // 1. Retrieve Pinecone index
  const index = client.Index(indexName);
  // 2. Log retrieved index name
  console.log(`Pinecone index retrieved: ${indexName}`);
  // 3. Process each document in the docs array
  for (const doc of docs) {
    console.log(`Processing document: ${doc.metadata.source}`);
    const txtPath = doc.metadata.source;
    const text = doc.pageContent;

    // 4. Create RecursiveCharacterTextSplitter instance
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });

    console.log("Splitting text into chunks...");
    // 5. Split text into chunks (documents)
    const chunks = await textSplitter.createDocuments([text]);
    console.log(`Text split into ${chunks.length} chunks`);
    console.log(
      `Calling OpenAI's Embedding endpoint documents with ${chunks.length} text chunks... `
    );

    // 6. Create OpenAI embeddings for documents
    const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(
      chunks.map((chunk) => chunk.pageContent.replace(/\n/g, ""))
    );

    // 7. Create and upsert vectors in batches of 100
    const batchSize = 100;
    let batch: Array<PineconeRecord<Record<string, any>>> = [];

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const vector: PineconeRecord<Record<string, any>> = {
        id: `${txtPath}_${idx}`,
        values: embeddingsArrays[idx],
        metadata: {
          ...chunk.metadata,
          loc: JSON.stringify(chunk.metadata.loc),
          pageContent: chunk.pageContent,
          txtPath: txtPath,
        },
      };
      batch = [...batch, vector];

      if (batch.length === batchSize || idx === chunks.length - 1) {
        try {
          console.log("Inserting batch into PineCone...");
          await index.upsert(batch);
          // Empty the batch
          batch = [];
        } catch (error) {
          console.log("[PineCone Upsert Error]: ", error);
        }
      }
    }
  }
};

export const queryPineconeVectorStoreAndQueryLLM = async (
  client: Pinecone,
  indexName: string,
  question: string
) => {
  // 1. Start query process
  console.log("Querying Pinecone vector store... Question -> ", question);

  // 2. Retrieve the Pinecone index
  const index = client.Index(indexName);

  // 3. Create query embedding
  const queryEmbedding = await new OpenAIEmbeddings().embedQuery(question);

  let queryResponse = await index.query({
    topK: 10,
    vector: queryEmbedding,
    includeMetadata: true,
    includeValues: true,
  });

  // 5. Log number of matches
  console.log(`Found ${queryResponse.matches.length} matches...`);
  console.log("*** PINECONE MATCHES ***");
  console.log(
    JSON.stringify(queryResponse.matches.map((match) => match.metadata))
  );
  console.log("***");

  // 6. Log the question being asked
  console.log(`Asking question: ${question}... `);

  if (queryResponse.matches.length) {
    // 7. Create an OpenAI instance and load the QAStuffChain
    const llm = new OpenAI({});
    const chain = loadQAStuffChain(llm);

    // 8. Extract and concatenate page content from matched documents.

    const concatenatedPageContent = queryResponse.matches
      .map((match) => match.metadata?.pageContent)
      .join(" ");

    const result = await chain.call({
      input_documents: [new Document({ pageContent: concatenatedPageContent })],
      question: question,
    });

    // 9. Log the answer
    console.log(`Answer: ${result.text}`);
    return result.text;
  } else {
    // 10. Log that there are no matches, so GPT-3 will not be queried.
    console.log("Since there are no matches, GPT-3 will not be queried");
  }
};
