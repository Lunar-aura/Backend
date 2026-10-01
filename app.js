import express from 'express'

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello Backend!");
});

app.get("/about", (req, res) => {
    res.send("About Page");
});

app.get("/contact", (req, res) => {
    res.send("Contact Page");
});

const users = [
    { id: 1, name: "Ali" },
    { id: 2, name: "Sara" },
    { id: 3, name: "Ahmed" },
    { id: 4, name: "Hassan" },
    { id: 5, name: "Ayesha" },
];

// GEt
app.get("/users", (req, res) => {
    res.json(users);
});
// get id
app.get("/users/:id", (req, res) => {
    const id = req.params.id;

    const user = users.find((user) => user.id == id);

    if (!user) {
        return res.status(404).send("User not found");
    }
    res.json(user);
});
// get name
app.get("/search", (req, res) => {
    const name = req.query.name;

    const user = users.find((user) => user.name == name);
    if (!user) {
        return res.status(404).send("User not found");
    }
    res.json(user);
});

// POST 
app.post("/users", (req, res) => {
    const user = req.body;


    if (!user.id || !user.name) {
        return res.status(400).send("ID and name are required");
    }

    // dupictae id check
    const existingUser = users.find((u) => u.id == user.id);

    if (existingUser) {
        return res.status(409).send("User ID already exists");
    }

    users.push(user);
    res.json(user);
});


// update/put
app.put("/users/:id", (req, res) => {
    const id = req.params.id;
    const newName = req.body.name;

    if (!newName) {
        return res.status(400).send("Name is required");
    }
    const user = users.find((user) => user.id == id);

    if (!user) {
        return res.status(404).send("User not found");
    }


    user.name = newName;

    res.json(user);
});

// delete
app.delete("/users/:id", (req, res) => {
    const id = req.params.id;

    const user = users.find((user) => user.id == id);

    if (!user) {
        return res.status(404).send("User not found");
    }

    const index = users.indexOf(user);

    users.splice(index, 1);

    res.json(user);
});
app.listen(5000, () => {
    console.log("Server is running on port 5000");
});