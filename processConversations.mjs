import { summarizeConversation, transcribeAudioWithWhisper } from './openaiService.mjs';
import platformClient from 'purecloud-platform-client-v2';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const REGION = platformClient.PureCloudRegionHosts.eu_west_1;
const MAX_RETRIES = 5;

export async function processInteraction(token, id, type) {
  type = type.trim().toLowerCase();

  const apiClient = platformClient.ApiClient.instance;
  apiClient.setEnvironment(REGION);
  apiClient.setAccessToken(token);

  const recordingApi = new platformClient.RecordingApi();
  const recordings = await obtenerGrabacionesConReintentos(recordingApi, id);

  if (!recordings || recordings.length === 0) {
    throw new Error('No se encontraron grabaciones.');
  }

  const mediaType = recordings[0]?.media.toLowerCase();

  if (mediaType === 'message') {
    return procesarMensajesMessage(recordings[0].messagingTranscript);
  } else if (mediaType === 'chat') {
    return procesarMensajesChat(recordings[0].transcript);
  } else if (mediaType === 'voice' || mediaType === 'callback' || mediaType === 'audio') {
    return await procesarGrabacionDeVoz(recordings[0], recordingApi);
  } else {
    throw new Error(`Tipo de interacción no soportado: ${mediaType}`);
  }
}

async function obtenerGrabacionesConReintentos(apiInstance, conversationId) {
  let delay = 1000;
  const maxDelay = 5000;

  for (let intento = 1; intento <= MAX_RETRIES; intento++) {
    try {
      const data = await apiInstance.getConversationRecordings(conversationId, {
        maxWaitMs: 5000,
        formatId: 'MP3'
      });

      if (data && data.length > 0) {
        return data;
      }

      console.warn(`Intento ${intento}: grabaciones vacías, reintentando...`);
    } catch (err) {
      console.error(`Error en intento ${intento}`, err);
      if (err.status === 401 || err.status === 403) throw err;
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, maxDelay);
  }

  return null;
}

async function procesarGrabacionDeVoz(recording, apiInstance) {
  const metadata = await llamadaConReintentos(() =>
    apiInstance.getConversationRecording(recording.conversationId, recording.id, {
      formatId: 'MP3',
      download: true
    }),
    'getConversationRecording'
  );

  const mediaUri = metadata?.mediaUris?.S?.mediaUri;
  if (!mediaUri) throw new Error('No se pudo obtener URL de descarga.');

  const ruta = await descargarAudio(mediaUri);
  const resultado = await transcribeAudioWithWhisper(ruta);

  fs.unlinkSync(ruta);

  return resultado;
}

async function llamadaConReintentos(fn, descripcion = 'llamada API') {
  let delay = 1000;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`Fallo en ${descripcion} (intento ${i}): ${err.message}`);
      if (i === MAX_RETRIES || [401, 403].includes(err.status)) throw err;
      await new Promise(res => setTimeout(res, delay));
      delay = Math.min(delay * 2, 5000);
    }
  }
}

function procesarMensajesChat(transcript) {
  const texto = transcript
    .filter(m => m.bodyType === 'STANDARD')
    .map(m => `[${m.participantPurpose === 'customer' ? 'Cliente' : 'Agente'}] ${m.body}`)
    .join('\n');

  return summarizeConversation(texto);
}

function procesarMensajesMessage(messagingTranscript) {
  const texto = messagingTranscript
    .map(m => `[${m.purpose === 'customer' ? 'Cliente' : 'Agente'}] ${m.messageText}`)
    .join('\n');

  return summarizeConversation(texto);
}

async function descargarAudio(url) {
  const isLambda = !!process.env.LAMBDA_TASK_ROOT;

  const basePath = isLambda ? '/tmp' : './';
  const tempPath = path.join(basePath, `${crypto.randomUUID()}.mp3`);

  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const response = await axios({ url, method: 'GET', responseType: 'stream' });

  const writer = fs.createWriteStream(tempPath);

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return tempPath;
}
