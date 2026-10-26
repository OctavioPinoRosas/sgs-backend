const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Configurar CORS para permitir peticiones únicamente desde tu GitHub Pages (o abierto con '*')
app.use(cors({
    origin: '*' // O puedes poner: 'https://tu-usuario.github.io'
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Endpoint que llamará tu frontend
app.post('/api/ia', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Falta el texto de consulta (prompt).' });
    }

    try {
        // La API Key se lee de forma segura desde las variables de entorno de Render
        const apiKey = process.env.AI_API_KEY; 

        // EJEMPLO: Llamada fetch a la API de OpenAI (puedes adaptarla a Google Gemini si prefieres)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "Eres un asistente experto en los manuales de servicio y maquinaria agrícola de Gimtrac." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 300
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            const respuestaIA = data.choices[0].message.content;
            res.json({ respuesta: respuestaIA });
        } else {
            res.status(500).json({ error: "La IA no devolvió una respuesta válida." });
        }

    } catch (error) {
        console.error("Error en el servidor proxy:", error);
        res.status(500).json({ error: "Error interno al procesar la consulta con la IA." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor proxy corriendo en el puerto ${PORT}`);
});