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
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Falta la consulta.' });
    }

    try {
        const apiKey = process.env.AI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "No se ha configurado AI_API_KEY en Render." });
        }

        // Llamada a Google Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Eres un asistente experto en manuales de servicio de maquinaria agrícola Gimtrac. Responde brevemente a la siguiente pregunta: ${prompt}`
                    }]
                }]
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            const respuestaIA = data.candidates[0].content.parts[0].text;
            res.json({ respuesta: respuestaIA });
        } else {
            console.error("Respuesta de la API:", data);
            res.status(500).json({ error: "La IA no devolvió una respuesta válida." });
        }

    } catch (error) {
        console.error("Error en servidor proxy:", error);
        res.status(500).json({ error: "Error interno en el servidor proxy." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor proxy en puerto ${PORT}`);
});
