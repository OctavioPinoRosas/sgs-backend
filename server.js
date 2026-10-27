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

        const systemInstruction = `
Eres el Asistente IA del Sistema de Gestión del Servicio (SGS) de Gimtrac.
Responde a la duda del usuario ÚNICAMENTE utilizando la información exacta provista en la siguiente lista de manuales/procedimientos:

BASE DE DATOS DE MANUALES DISPONIBLES:
${JSON.stringify(contextoManuales || [], null, 2)}

REGLAS OBLIGATORIAS:
1. Sé preciso, profesional y fundamenta numéricamente la respuesta si el manual contiene listas numeradas o procedimientos estandarizados.
2. Identifica cuál es el ID del manual que contiene la respuesta y asígnalo en el campo 'manualId'. Si no pertenece a ninguno, déjalo como null.
3. Debes devolver la respuesta estrictamente en un objeto JSON válido con la siguiente estructura exacta:
{
  "respuesta": "Texto detallado y fundamentado de la respuesta...",
  "manualId": "ID_DEL_MANUAL_CONSULTADO"
}
        `;

        // Lista de modelos en orden de prioridad (si el primero falla por 503, intenta con los siguientes)
        const modelosDisponibles = [
            'gemini-3.6-flash',
            'gemini-3.8-flash',
            'gemini-2.5-flash'
        ];

        let data = null;
        let modeloExitoso = '';

        for (const modelo of modelosDisponibles) {
            console.log(`Intentando conectar con el modelo: ${modelo}...`);
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            data = await response.json();

            // Si la API responde sin error, salimos del ciclo
            if (!data.error) {
                modeloExitoso = modelo;
                console.log(`¡Éxito con el modelo ${modelo}!`);
                break;
            } else {
                console.warn(`Aviso: El modelo ${modelo} falló con código ${data.error.code}: ${data.error.message}`);
            }
        }

        // Si después de probar todos los modelos hubo error (ej. 503 en todos)
        if (!data || data.error) {
            return res.status(503).json({ 
                error: "El servicio de IA está experimentando alta demanda en este momento. Por favor, intenta de nuevo en unos segundos." 
            });
        }

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const rawJson = data.candidates[0].content.parts[0].text;
            const parsedResult = JSON.parse(rawJson);

            res.json({
                respuesta: parsedResult.respuesta,
                manualId: parsedResult.manualId || null,
                modeloUtilizado: modeloExitoso
            });
        } else {
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
