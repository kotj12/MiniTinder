import express from 'express'
import fileUpload from 'express-fileupload'
import path from 'path'
import fs from 'fs'

const app = express()
const PORT = 4000

// Ujisti se, že složka existuje
const uploadDir = path.resolve('public/uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

// Middleware
app.use(fileUpload())

// Upload endpoint
app.post('/upload', (req, res) => {
    const image = req.files?.image
    const userId = req.body?.userId

    if (!image || !userId) return res.status(400).send("Missing image or userId")
    if (!/^image/.test(image.mimetype)) return res.status(400).send("Invalid file type")

    const ext = path.extname(image.name)
    const filename = `${userId}${ext}`
    const savePath = path.join(uploadDir, filename)

    image.mv(savePath, (err) => {
        if (err) return res.status(500).send("Failed to save file")
        res.json({ imageUrl: `/uploads/${filename}` })
    })
})

app.listen(PORT, () => {
    console.log(`Upload server running on http://localhost:${PORT}`)
})