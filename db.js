import { Pool } from "pg";

const pool = new Pool({
    user : "postgres",
    host: "localhost",
    database: "backend_db",
    password: "Postgres@123",
    port: 5432,
});

pool.query("SELECT NOW()" , (error, result) => {
    if(error){
        console.log("Database connection failed");
        console.log(error);
    } else {
        console.log("Database connection successful");
        console.log(result.rows[0]);
    }
});

export default pool;