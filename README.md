<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Mini-Dating-App</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .filters, .profile { margin-bottom: 20px; }
    .profile { border: 1px solid #ccc; padding: 10px; }
  </style>
</head>
<body>
  <h1>Dating-App</h1>

  <div class="filters">
    <label>Alter: <input type="number" id="age" /></label>
    <label>Größe (cm): <input type="number" id="height" /></label>
    <label>Geschlecht:
      <select id="gender">
        <option value="">--</option>
        <option value="m">Männlich</option>
        <option value="w">Weiblich</option>
        <option value="d">Divers</option>
      </select>
    </label>
    <label>Haarfarbe:
      <select id="hair">
        <option value="">--</option>
        <option value="blond">Blond</option>
        <option value="braun">Braun</option>
        <option value="schwarz">Schwarz</option>
        <option value="rot">Rot</option>
      </select>
    </label>
    <label>Gewicht (kg): <input type="number" id="weight" /></label>
    <label>Körbchengröße:
      <select id="cup">
        <option value="">--</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
        <option value="E">E</option>
        <option value="F">F</option>
      </select>
    </label>
    <label>Ausbildung:
      <select id="edu">
        <option value="">--</option>
        <option value="Hauptschule">Hauptschule</option>
        <option value="Realschule">Realschule</option>
        <option value="Abitur">Abitur</option>
        <option value="Studium">Studium</option>
      </select>
    </label>
    <button onclick="filterProfiles()">Filtern</button>
  </div>

  <div id="results"></div>

  <script>
    const profiles = [
      { name: "Anna", age: 28, height: 165, gender: "w", hair: "blond", weight: 60, cup: "C", edu: "Studium" },
      { name: "Ben", age: 32, height: 180, gender: "m", hair: "braun", weight: 80, cup: "", edu: "Abitur" },
      { name: "Clara", age: 24, height: 170, gender: "w", hair: "rot", weight: 55, cup: "B", edu: "Studium" },
      // Weitere Profile...
    ];

    function filterProfiles() {
      const age = parseInt(document.getElementById("age").value);
      const height = parseInt(document.getElementById("height").value);
      const gender = document.getElementById("gender").value;
      const hair = document.getElementById("hair").value;
      const weight = parseInt(document.getElementById("weight").value);
      const cup = document.getElementById("cup").value;
      const edu = document.getElementById("edu").value;

      const filtered = profiles.filter(p =>
        (!age || p.age === age) &&
        (!height || p.height === height) &&
        (!gender || p.gender === gender) &&
        (!hair || p.hair === hair) &&
        (!weight || p.weight === weight) &&
        (!cup || p.cup === cup) &&
        (!edu || p.edu === edu)
      );

      const results = document.getElementById("results");
      results.innerHTML = filtered.length
        ? filtered.map(p => `<div class="profile">${p.name}, ${p.age} Jahre, ${p.height}cm, ${p.hair}es Haar</div>`).join("")
        : "<p>Keine Treffer.</p>";
    }
  </script>
</body>
</html>
