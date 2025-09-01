import OpenAI from 'openai';
import config from './config.json' assert { type: 'json' };
import fs from 'fs';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

export async function summarizeConversation(text) {
  const response = await openai.chat.completions.create({
    model: config.OPENAI_MODEL || 'gpt-4o',
    messages: [{ role: 'user', content: `Resume la siguiente conversación:\n${text}` }],
    stream: false,
  });

  const resumen = response.choices?.[0]?.message?.content || '';
  return { resumen: resumen.trim(), transcript: text };
}

export async function transcribeAudioWithWhisper(filePath) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
  });

  const orderedTranscript = await ordenarTranscription(transcription.text);
  const resumenObj = await summarizeConversation(orderedTranscript);

  return { resumen: resumenObj.resumen, transcript: orderedTranscript };
}

async function ordenarTranscription(transcription) {
  const prompt = `Reestructura la transcripción para diferenciar las intervenciones de cliente y agente de manera ordenada.`;

  const response = await openai.chat.completions.create({
    model: config.OPENAI_MODEL || 'gpt-4o',
    messages: [{ role: 'user', content: `${prompt}\n${transcription}` }],
    stream: false,
  });

  return response.choices?.[0]?.message?.content || transcription;
}
