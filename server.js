const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("Servidor SGS Backend Proxy activo.");
});

app.post('/api/ia', async (req, res) => {
    const { prompt, contextoManuales } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Falta la consulta.' });
    }

    try {
        const apiKey = process.env.AI_API_KEY;

        if (!apiKey) {
            console.error("Error: No existe AI_API_KEY en las variables de entorno.");
            return res.status(500).json({ error: "No se ha configurado AI_API_KEY en Render." });
        }

        // Instrucción de sistema para restringir a la IA estrictamente a los manuales provistos
        const systemInstruction = `
Eres el Asistente IA del Sistema de Gestión del Servicio (SGS) de Gimtrac.
Responde a la duda del usuario ÚNICAMENTE utilizando la información exacta provista en la siguiente lista de manuales/procedimientos:

BASE DE DATOS DE MANUALES DISPONIBLES:
${JSON.stringify(contextoManuales || [], null, 2)}

REGLAS OBLIGATORIAS:
1. Sé preciso, profesional y fundamenta numéricamente la respuesta si el manual contiene listas numeradas o procedimientos estandarizados.
2. Identifica cuál es el ID del manual que contiene la respuesta y asígnalo en el campo 'manualId'.
3. Debes devolver la respuesta estrictamente en un objeto JSON válido con la siguiente estructura exacta:
{
  "respuesta": "Texto detallado y fundamentado de la respuesta...",
  "manualId": "ID_DEL_MANUAL_CONSULTADO"
}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemInstruction}\n\nPregunta del técnico u operador: ${prompt}`
                    }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Error devuelto por la API de Gemini:", JSON.stringify(data.error));
            return res.status(500).json({ error: data.error.message || "Error devuelto por Gemini." });
        }

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const rawJson = data.candidates[0].content.parts[0].text;
            const parsedResult = JSON.parse(rawJson);

            res.json({
                respuesta: parsedResult.respuesta,
                manualId: parsedResult.manualId || null
            });
        } else {
            console.error("Estructura de respuesta inesperada:", JSON.stringify(data));
            res.status(500).json({ error: "La IA no devolvió una respuesta válida." });
        }

    } catch (error) {
        console.error("Error crítico en servidor proxy:", error);
        res.status(500).json({ error: "Error interno en el servidor proxy." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor proxy en puerto ${PORT}`);
});
