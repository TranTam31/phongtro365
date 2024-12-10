const express = require('express');
const app = express()
const path = require('path');

const cors = require('cors')
app.use(cors({
    credentials: true,
    // origin: 'http://localhost:5173'
    origin: 'http://fall2024c56g11.int3306.freeddns.org/'
}))

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use(express.json())

// routes
const usersRouter = require("./routes/Users");
app.use("/auth", usersRouter);
const postsRouter = require("./routes/Posts");
app.use("/post", postsRouter);
const bookingsRouter = require("./routes/Bookings");
app.use("/booking", bookingsRouter);
const adminRouter = require("./routes/Admin");
app.use("/admin-api", adminRouter);

app.listen(4000, () => {
    console.log("Server running on port 4000");
})