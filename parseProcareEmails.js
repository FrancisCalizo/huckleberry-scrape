// https://github.com/mikebevz/node-imap
// https://www.youtube.com/watch?v=YFYQucqgvN4
// https://nodemailer.com/extras/mailparser/#options
// 🚀  node parseProcareEmails.js

require("dotenv").config();

const nodemailer = require("nodemailer");
const { simpleParser } = require("mailparser");
const Imap = require("node-imap");

const BREASTMILK_OZ = 5;
const FORMULA_OZ = 6;

const today = new Date();

const formattedDate = today.toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const imap = new Imap({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: process.env.EMAIL_HOST,
  port: 993,
  tls: true,
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility to open a mailbox
function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

let huckleBerryText = "";
let checkAgainst =
  "<br/><br/><p>____CHECK AGAINST UNFORMATTED BELOW!____</p><br/>";

// Start IMAP connection
imap.once("ready", function () {
  openInbox(function (err, box) {
    if (err) throw err;

    // Search for Procare emails
    imap.search(
      // ["UNSEEN", ["FROM", "no-reply@procare.com"]],
      [
        "All",
        ["FROM", "fccalizo@gmail.com"],
        ["SUBJECT", "Daily Summary"],
        ["SENTON", formattedDate],
      ],
      function (err, results) {
        if (err || results.length === 0) {
          console.log("No new Procare emails found.");
          imap.end();
          return;
        }

        const f = imap.fetch(results, { bodies: "" });

        console.log("Matching Emails found: ", results.length);

        f.on("message", function (msg, seqno) {
          console.log(seqno);
          msg.on("body", function (stream, info) {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error("Parse error:", err);
                return;
              }

              const subject = parsed.subject;
              const body = parsed.text; // or parsed.html

              // console.log(`\n🟡 Parsed Subject: ${subject}`);
              // console.log(`📧 Email Content:\n${body}`);

              // Sleepy Time
              let napText;

              const napMatch = body.match(/Slept from.*?(?=\n|$)/gi);

              if (napMatch) {
                napText = napMatch.map((n) =>
                  n.replace("Slept", "Record sleep")
                );
              }

              // Hungry Baby
              let feedText = null;
              const feedMatch = body.match(/drank.*?(?=\n|$)/gi);

              if (feedMatch) {
                feedText = feedMatch.map((f, idx) => {
                  const match = f.match(/@[^AP]*\s?[AP]M/i);

                  // First feeding usually Breastmilk
                  if (match) {
                    if (idx == 0) {
                      return `Record ${BREASTMILK_OZ}oz of Breast Milk ${match[0]}`;
                    }

                    return `Record ${FORMULA_OZ}oz of Formula ${match[0]}`;
                  }

                  return null;
                });
              }

              // PeePee
              let peeText = null;

              const peeMatch = body.match(
                /(?=.*\bwet\b)(?=.*\bdiaper was changed\b).*?(?=\n|$)/gi
              );

              if (peeMatch) {
                peeText = peeMatch.map((p) =>
                  p
                    .replace(/^.*?was changed\.\s*/i, "Record Pee ")
                    .replace(/([AP]M).*/i, "$1")
                );
              }

              // PooPoo
              let pooText = null;

              const pooMatch = body.match(
                /(?=.*\bbm\b)(?=.*\bdiaper was changed\b).*?(?=\n|$)/gi
              );

              if (pooMatch) {
                pooText = pooMatch.map((p) =>
                  p
                    .replace(/^.*?was changed\.\s*/i, "Record Poo ")
                    .replace(/([AP]M).*/i, "$1")
                );
              }

              // Step 2: Format for Email

              if (peeText) {
                huckleBerryText += `<p>${peeText.join("<br/>")}</p>`;
              }

              if (pooText) {
                huckleBerryText += `<p>${pooText.join("<br/>")}</p>`;
              }

              if (napText) {
                huckleBerryText += `<p>${napText.join("<br/>")}</p>`;
              }

              if (feedText) {
                huckleBerryText += `<p>${feedText.join("<br/>")}</p>`;
              }

              // Step 3: Create a "Check Against" to verify

              if (peeMatch) {
                checkAgainst += `<p>${peeMatch.join("<br/>")}</p>`;
              }

              if (pooMatch) {
                checkAgainst += `<p>${pooMatch.join("<br/>")}</p>`;
              }

              if (napMatch) {
                checkAgainst += `<p>${napMatch.join("<br/>")}</p>`;
              }

              if (feedMatch) {
                checkAgainst += `<p>${feedMatch.join("<br/>")}</p>`;
              }

              // console.log(`\n✅ Check Against Format:\n${checkAgainst}`);
              console.log(huckleBerryText);

              transporter.sendMail(
                {
                  from: process.env.EMAIL_USER,
                  to: process.env.TO_EMAIL_ONE,
                  subject: `Primose to Huckleberry Inputs for ${formattedDate}`,
                  html: huckleBerryText + checkAgainst,
                },
                (error, info) => {
                  if (error) {
                    console.log(error);
                  } else {
                    console.log("Email Sent", info.response);
                  }
                }
              );
            });
          });
        });

        f.once("error", function (err) {
          console.error("Fetch error: " + err);
        });

        f.once("end", function () {
          console.log("Done fetching all Procare emails.");

          imap.end();
        });
      }
    );
  });
});

imap.once("error", function (err) {
  console.error(err);
});

imap.once("end", function () {
  console.log("Connection ended.");
});

imap.connect();
