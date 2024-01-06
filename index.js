const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const app = express();
const bcrypt = require("bcrypt");
require("dotenv").config();
const PORT = process.env.PORT || 19962;
const jwt = require("jsonwebtoken");

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.SERVER_HOST,
  user: process.env.SERVER_USER,
  password: process.env.SERVER_PASSWORD,
  database: process.env.SERVER_DATABASE,
  port: PORT,
});

// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "root",
//   database: "mia",
//   //port: PORT,
// });

const createEncryptedToken = (object_of_data) => {
  return jwt.sign(object_of_data, process.env.SECRET_KEY);
};

const getPlaceId = (airport) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id FROM flight_places WHERE airport_name = ?";
    db.query(sql, [airport], (err, res) => {
      if (err) {
        reject(-1);
      }
      resolve(res[0].id);
    });
  });
};

app.put("/mia/api/insert-user-account", (req, res) => {
  const {
    firstName,
    lastName,
    gender,
    birthDate,
    phoneNumber,
    email,
    password,
  } = req.body;
  const salt = bcrypt.genSaltSync(10);

  const _value = [
    firstName,
    lastName,
    gender,
    birthDate,
    phoneNumber,
    email,
    bcrypt.hashSync(password, salt),
  ];

  const sql =
    "INSERT INTO useraccounts (first_name, last_name, gender, birth_date, phone_number, email, password) value (?,?,?,?,?,?,?)";
  db.query(sql, _value, (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.json({
          status: 500,
          title: "Email address error",
          message:
            "Email address already exists. Please enter a different email.",
        });
      }
      return res.json({
        status: 500,
        title: "Database Connection Error",
        message: "An error occurred in the database. Please try again later.",
      });
    }
    return res.json({
      status: 200,
      title: "Success",
      message: "You've successfully created your account",
    });
  });
});

app.post("/mia/api/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM useraccounts WHERE email = ?";
  db.query(sql, [email], (err, result) => {
    if (err) {
      return res.json({
        status: 500,
        title: "Database Connection Error",
        message: "An error occurred in the database. Please try again later.",
      });
    }
    if (result.length == 0) {
      return res.json({
        status: 500,
        title: "Account not found",
        message:
          "Account doesn't exist. Please check your details and try again.",
      });
    }
    if (bcrypt.compareSync(password, result[0].password)) {
      return res.json({
        status: 200,
        title: "Success",
        message: "Login successful",
        token: createEncryptedToken({ ...result[0] }),
      });
    }
    return res.json({
      status: 500,
      title: "Account error",
      message: "Email and password do not match. Please try again.",
    });
  });
});

app.get("/mia/api/decode-token/:token", (req, res) => {
  const token = req.params.token;
  res.json({ status: 200, data: jwt.decode(token) });
});

app.get("/mia/api/password-validation/:password/:id", (req, res) => {
  const password = req.params.password;
  const id = req.params.id;
  const sql = "SELECT password from useraccounts WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.json({
        status: 500,
        title: "Database Error",
        message: "Something error...",
      });
    }
    return res.json({
      status: 200,
      data: bcrypt.compareSync(password, result[0].password),
    });
  });
});

app.put("/mia/api/update-account/:id", (req, res) => {
  const id = req.params.id;
  const { first_name, last_name, phone_number, new_password } = req.body;
  const salt = bcrypt.genSaltSync(10);
  let data, sql;

  if (new_password) {
    const PASSWORD = bcrypt.hashSync(new_password, salt);
    sql =
      "UPDATE useraccounts SET first_name = ?, last_name = ?, phone_number = ?, password = ? WHERE id = ?";
    data = [first_name, last_name, phone_number, PASSWORD, id];
  } else {
    sql =
      "UPDATE useraccounts SET first_name = ?, last_name = ?, phone_number = ? WHERE id = ?";
    data = [first_name, last_name, phone_number, id];
  }
  db.query(sql, data, (err, result) => {
    if (err) {
      return res.json({ status: 500 });
    }

    db.query(
      "SELECT * FROM useraccounts WHERE id = ?",
      [id],
      (err_, result_) => {
        if (err_) return res.json({ status: 500 });
        return res.json({
          status: 200,
          token: createEncryptedToken({ ...result_[0] }),
        });
      }
    );
  });
});

app.get("/mia/api/places", (req, res) => {
  const sql = "SELECT *, airport_name as airport FROM flight_places";
  db.query(sql, [], (err, result) => {
    if (err) {
      return res.json({
        status: 500,
        message: "Database connection error",
        title: "Database error",
      });
    }
    return res.json({ status: 200, data: [...result] });
  });
});

app.put("/mia/api/return-book", (req, res) => {
  const { account_data, book_data } = req.body;
  const ACC_DATA = [
    account_data.userId,
    account_data.type,
    account_data.children,
    account_data.adult,
    account_data.senior,
    account_data.pwd,
    account_data.class,
  ];
  let sql =
    "INSERT INTO book (user_id, type, children, adult, senior, pwd, class) value (?,?,?,?,?,?,?)";
  db.query(sql, ACC_DATA, (err, result) => {
    if (err) {
      return res.json({
        status: 500,
        title: "Database Connection Error",
        message: "An error occurred in the database. Please try again later.",
      });
    }
    getPlaceId(book_data.from).then((fromId) => {
      getPlaceId(book_data.to).then((toId) => {
        sql =
          "INSERT INTO return_book (`book_id`, `from`, `to`, `departure`, `return`) value (?,?,?,?,?)";
        const BOOK_DATA = [
          result.insertId,
          fromId,
          toId,
          book_data.depart,
          book_data.return,
        ];
        db.query(sql, BOOK_DATA, (b_err, b_result) => {
          if (b_err) {
            return res.json({
              status: 500,
              title: "Database Connection Error",
              message:
                "An error occurred in the database. Please try again later.",
            });
          }
          return res.json({
            status: 200,
            title: "Booking Successful",
            message:
              "Congratulations! Your airline reservation has been successfully confirmed. We look forward to welcoming you on board. Safe travels!",
          });
        });
      });
    });
  });
});

app.get("/mia/api/get-place-id/:place", (req, res) => {
  const place = req.params.place;
  const sql = "SELECT id FROM flight_places WHERE airport_name = ?";
  db.query(sql, [place], (err, result) => {
    if (err) {
      return res.json({ status: 500 });
    }
    return res.json({ status: 200, id: result[0].id });
  });
});

app.get("/mia/api/get-place-by-id/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM flight_places WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.json({
        status: 500,
      });
    }
    return res.json({
      status: 200,
      data: { ...result[0] },
    });
  });
});

app.get("/mia/api/get-prices", (req, res) => {
  const sql = "SELECT * FROM prices";
  db.query(sql, [], (err, result) => {
    return res.json({ status: 200, prices: { ...result[0] } });
  });
});

app.get("/mia/api/search-available-flight/:fromId/:toId", (req, res) => {
  const fromId = req.params.fromId;
  const toId = req.params.toId;
  const sql =
    "SELECT * FROM `available_flights` WHERE from_place_id = ? AND to_place_id = ? AND availability = 1";
  db.query(sql, [fromId, toId], (err, result) => {
    if (err) {
      return res.json({
        status: 500,
      });
    }
    if (result.length === 0) {
      return res.json({
        status: 404,
      });
    }
    return res.json({
      status: 200,
      data: { ...result[0] },
    });
  });
});

app.post("/mia/api/check-connection", (req, res) => {
  const sql = "SHOW databases";
  db.query(sql, [], (err, result) => {
    if (err) {
      return res.json({
        status: 500,
        title: "Database Connection Error",
        message: "An error occurred in the database. Please try again later.",
      });
    }
    return res.json({
      status: 200,
    });
  });
});

app.post("/mia/api/book", (req, res) => {
  const {
    userId,
    type,
    passengers,
    _class,
    total,
    reference,
    from,
    to,
    departure,
    _return,
    payment_method,
    flight_id,
  } = req.body;

  let sql =
    "INSERT INTO book (`user_id`, `type`, `child`, `adult`, `senior`, `pwd`, `class`, `total`, `status`, `reference`, `payment_method`, `message`) value (?,?,?,?,?,?,?,?,?,?,?,?)";
  db.query(
    sql,
    [
      userId,
      type,
      passengers.child,
      passengers.adult,
      passengers.senior,
      passengers.pwd,
      _class,
      total,
      "pending",
      reference,
      payment_method,
      "",
    ],
    (err, result) => {
      if (err) {
        return res.json({ status: 500 });
      }
      const bookId = result.insertId;
      if (type === "return") {
        sql =
          "INSERT INTO return_book (`book_id`, `from`, `to`, `departure`, `return`) value (?,?,?,?,?)";
        db.query(sql, [bookId, from, to, departure, _return], (errd, ress) => {
          const update_sql =
            "UPDATE available_flights SET count = count + 1 WHERE id = ?";
          db.query(update_sql, [flight_id], (u_err, u_res) => {
            return res.json({ status: 200 });
          });
        });
      } else if (type === "one_way") {
        sql =
          "INSERT INTO one_way_book (`book_id`, `from`, `to`, `departure`) value (?,?,?,?)";
        db.query(sql, [bookId, from, to, departure], (errd, ress) => {
          const update_sql =
            "UPDATE available_flights SET count = count + 1 WHERE id = ?";
          db.query(update_sql, [flight_id], (u_err, u_res) => {
            return res.json({ status: 200 });
          });
        });
      }
    }
  );
});

app.get("/mia/api/get-return-flight/:book_id", (req, res) => {
  const id = req.params.book_id;
  const sql = "SELECT * FROM `return_book` WHERE book_id = ?";
  db.query(sql, [id], (err, result) => {
    return res.json({ status: 200, data: { ...result[0] } });
  });
});

app.get("/mia/api/get-oneway-flight/:book_id", (req, res) => {
  const id = req.params.book_id;
  const sql = "SELECT * FROM `one_way_book` WHERE book_id = ?";
  db.query(sql, [id], (err, result) => {
    return res.json({ status: 200, data: { ...result[0] } });
  });
});

app.get("/mia/api/get-flights/:id/:status", (req, res) => {
  const id = req.params.id;
  const status = req.params.status;
  let sql = "SELECT * FROM `book` WHERE `user_id` = ? AND `status` = ?";

  db.query(sql, [id, status], (err, result) => {
    if (err) {
      return res.json({ status: 500 });
    }
    if (result.length === 0) {
      return res.json({
        status: 200,
        data: [],
      });
    }
    return res.json({
      status: 200,
      data: [...result],
    });
  });
});

app.get("/mia/api/get-pending-and-done/:id", (req, res) => {
  const id = req.params.id;
  let sql =
    "SELECT * FROM `book` WHERE `user_id` = ? AND `status` IN ('pending', 'paid') ORDER BY date DESC";

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.json({ status: 500 });
    }
    if (result.length === 0) {
      return res.json({
        status: 200,
        data: [],
      });
    }
    return res.json({
      status: 200,
      data: [...result],
    });
  });
});

app.get("/mia/api/get-history-flights/:id", (req, res) => {
  const id = req.params.id;
  const sql =
    "SELECT * FROM `book` WHERE `user_id` = ? AND `status` IN ('done', 'cancelled') ORDER BY date DESC";
  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.json({ status: 500 });
    }
    if (result.length === 0) {
      return res.json({
        status: 200,
        data: [],
      });
    }
    return res.json({
      status: 200,
      data: [...result],
    });
  });
});

app.post("/mia/api/cancel-flight/:id", (req, res) => {
  const id = req.params.id;
  let { message } = req.body;
  message = "&&-" + message;
  const sql =
    "UPDATE `book` SET `status` = 'cancelled', message = ? WHERE id = ?";
  db.query(sql, [message, id], (err, result) => {
    if (err) {
      return res.json({ status: 500 });
    }
    return res.json({ status: 200 });
  });
});

app.put("/mia/api/set-done-flight/:id", (req, res) => {
  const id = req.params.id;
  const sql = "UPDATE `book` SET `status` = ? WHERE id = ?";
  db.query(sql, ["done", id], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200 });
  });
});

app.get("/mia/api/get-top-fights", (req, res) => {
  const url =
    "SELECT from_place.airport_name AS from_place, to_place.airport_name AS to_place, count FROM available_flights JOIN flight_places AS from_place ON available_flights.from_place_id = from_place.id JOIN flight_places AS to_place ON available_flights.to_place_id = to_place.id ORDER BY count DESC LIMIT 3";
  db.query(url, [], (err, result) => {
    if (err) {
      return res.json({ status: 500 });
    }
    return res.json({ status: 200, data: result });
  });
});

app.get("/mia/api/get-total-infos", (req, res) => {
  let url = "SELECT SUM(total) as total from book";
  db.query(url, [], (err, result) => {
    if (err) res.json({ status: 500 });
    const totalEarnings = result[0].total;
    url = "SELECT COUNT(*) as count FROM book WHERE status = 'pending'";
    db.query(url, [], (err, result) => {
      const pendingCount = result[0].count;
      url =
        "SELECT COUNT(*) as available from available_flights WHERE availability = 1";
      db.query(url, [], (err, result) => {
        const totalFlights = result[0].available;
        return res.json({
          status: 200,
          earnings: totalEarnings,
          pending: pendingCount,
          flights: totalFlights,
        });
      });
    });
  });
});

app.get("/mia/api/get-available-flights/:availability", (req, res) => {
  const availability = req.params.availability;
  let sql =
    "SELECT af.id, p1.id AS from_place_id, p1.airport_name AS from_place_name, p2.id AS to_place_id, p2.airport_name AS to_place_name, af.price, af.availability FROM available_flights AS af JOIN flight_places AS p1 ON af.from_place_id = p1.id JOIN flight_places AS p2 ON af.to_place_id = p2.id ORDER BY date DESC";
  let data = [];
  if (availability == 1 || availability == 0) {
    sql =
      "SELECT af.id, p1.id AS from_place_id, p1.airport_name AS from_place_name, p2.id AS to_place_id, p2.airport_name AS to_place_name, af.price, af.availability FROM available_flights AS af JOIN flight_places AS p1 ON af.from_place_id = p1.id JOIN flight_places AS p2 ON af.to_place_id = p2.id WHERE af.availability = ? ORDER BY date DESC";
    data = [availability];
  }
  db.query(sql, data, (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200, data: result });
  });
});

app.put("/mia/api/update-flight", (req, res) => {
  const { flightId, fromPlaceId, toPlaceId, availability, price } = req.body;
  const sql =
    "UPDATE available_flights SET from_place_id = ?, to_place_id = ?, availability = ?, price = ? WHERE id = ?";
  db.query(
    sql,
    [fromPlaceId, toPlaceId, availability, price, flightId],
    (err, result) => {
      if (err) return res.json({ status: 500 });
    }
  );
  res.json({ status: 200 });
});

app.put("/mia/api/insert-flight", (req, res) => {
  const { fromId, toId, price } = req.body;
  const sql =
    "INSERT INTO available_flights (from_place_id, to_place_id, price, availability, count) values (?,?,?,1,0)";
  db.query(sql, [fromId, toId, price], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200 });
  });
});

app.get("/mia/api/get-accounts", (req, res) => {
  const sql = "SELECT * FROM useraccounts";
  db.query(sql, [], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200, data: result });
  });
});

app.get("/mia/api/get-books", (req, res) => {
  const sql =
    "SELECT book.*, concat(first_name, ' ', last_name) as fullname from book join useraccounts on book.user_id = useraccounts.id";
  db.query(sql, [], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200, data: result });
  });
});

app.put("/mia/api/set-done", (req, res) => {
  const { id } = req.body;
  const sql = "UPDATE book SET status = 'paid' WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200 });
  });
});

app.get("/mia/api/prices", (req, res) => {
  const sql =
    "SELECT children_price as child, adult_price as adult, senior_price as senior, pwd_price as pwd, economy_price as economy, premium_class_price as premium, business_price as business FROM prices";
  db.query(sql, [], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200, data: result[0] });
  });
});

app.get("/mia/api/get-admin-account", (req, res) => {
  const sql = "SELECT * FROM admin_account";
  db.query(sql, [], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200, data: result[0] });
  });
});

app.put("/mia/api/update-prices", (req, res) => {
  const { child, adult, senior, pwd, economy, premium, business } = req.body;
  const sql =
    "UPDATE prices SET children_price = ?, adult_price = ?, senior_price = ?, pwd_price = ?, economy_price = ?, premium_class_price = ?, business_price = ? WHERE id = 'admin'";
  db.query(
    sql,
    [child, adult, senior, pwd, economy, premium, business],
    (err, result) => {
      if (err) return res.json({ status: 500 });
      return res.json({ status: 200 });
    }
  );
});

app.put("/mia/api/update-admin-account", (req, res) => {
  const { user, password } = req.body;
  const sql = "UPDATE admin_account SET user = ?, password = ? WHERE id = 1";
  db.query(sql, [user, password], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200 });
  });
});

app.put("/mia/api/insert-airport", (req, res) => {
  const { airport_name, location, country, code } = req.body;
  const sql =
    "INSERT INTO flight_places (airport_name, location, country, code, icon) value (?, ?, ?, ?, '')";
  db.query(sql, [airport_name, location, country, code], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200 });
  });
});

app.get("/mia/api/check-connections", (req, res) => {
  const sql = "SHOW databases";
  db.query(sql, [], (err, result) => {
    if (err) {
      return res.json({
        status: 500,
        title: "Database Connection Error",
        message: "An error occurred in the database. Please try again later.",
      });
    }
    return res.json({
      status: 200,
    });
  });
});

app.post("/mia/api/signin-admin", (req, res) => {
  const { user, password } = req.body;
  const sql =
    "SELECT COUNT(*) as count FROM admin_account WHERE user = ? AND password = ?";
  db.query(sql, [user, password], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200, data: result[0].count });
  });
});

app.get("/mia/api/get-refund", (req, res) => {
  const sql =
    "SELECT book.id, user_id, concat(useraccounts.first_name, ' ', useraccounts.last_name) as name, type, total, payment_method, reference, message, book.date FROM book join useraccounts on useraccounts.id = book.user_id WHERE message LIKE '%Request a refund for my payment.'";
  db.query(sql, [], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200, data: result });
  });
});

app.put("/mia/api/update-message", (req, res) => {
  const { message, book_id } = req.body;
  const sql = "UPDATE book SET message = ? WHERE id = ?";
  db.query(sql, [message, book_id], (err, result) => {
    if (err) return res.json({ status: 500 });
    return res.json({ status: 200 });
  });
});

app.listen(PORT, () => {
  console.log(`Server is now running on port ${PORT}`);
});
