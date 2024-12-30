export const meta = {
  name: "changename",
  description: "Changes the user's display name.",
  author: "Liane",
  version: "1.1.1",
  usage: "{prefix}changename <newName>",
  category: "User Management",
  permissions: [0],
  noPrefix: false,
  waitingTime: 5,
};

export async function entry({ input, output, money, args, Inventory, CassExpress }) {
  const userData = await money.get(input.senderID);
  let isRequire = !!userData.name;
  const name = args.join(" ");
  const inventory = new Inventory(userData.inventory);
  const cassExpress = new CassExpress(userData.cassExpress ?? {});
  if (!inventory.has("nameChanger") && isRequire) {
    return output.reply(
      "❌ You don't have the required item to change your name, there may or may not be a way to get it.",
    );
  }
  if (!name || name.length > 20) {
    return output.reply(
      "❌ Please enter a valid name (lower than 20 characters)",
    );
  }
  const names = {
    chara: "The true name.",
    frisk: "This name will trigger hardmode, proceed anyway?",
    sans: "You cannot use this name.",
    papyrus: "Are you kidding me? You cannot use this name.",
    alphys: "Can you atleast find your original name",
    undyne: "Very original.",
    toriel: "You are not goat mom!",
    asgore: "You are not goat dad!",
    martlet: "You are not a royal guard.",
    clover: "AMERICA! AMERICA!",
    ceroba: "You are not a fox.",
    liane: "Nice try.",
    nea: "Queen Nean is tired of licensing her name.",
    nean: "It's nea, but worse",
    kaye: "Just.. don't use this name",
    asriel: "You are nor goat prince.",
    starlo: "No america for you.",
    flowey: "Stfu.",
    sand: "I will let this one slide",
    papyru: "It doesn't have s, so proceed anyway.",
    muffet: "No no no spiders for now",
    mettaton: "I'm not a robot.",
    mtt: "No way, he used MTT, mettaton will gonna be mad.",
    axis: "Sorry human but you don't [freaking] deserve this name.",
    chujin: "Steamworks..",
    kanako: "Okay nevermind.",
    get gaster() {
      const err = {};
      err.stack = "system:sound_test";
      err.name = "Uknown";
      err.message = "Unknown issue. Beware of the man who speaks in hands.";
      throw err;
    },
  };
  const allowed = ["chara", "frisk", "clover", "sand", "papyru"];
  if (!names[name.toLowerCase()]) {
    allowed.push(name.toLowerCase());
  }
  const nameOk = allowed.includes(name.toLowerCase());
  let proceed = isRequire ? `Proceed for 1 🎟️` : `Proceed (Free 1st)`;
  const i =
    await output.reply(`* ${names[name] || names[name.toLowerCase()] || "Is the name correct?"}

**${name.split("").join(" ")}**

* Back
${nameOk ? `* ${proceed}` : ""}

🎟️ **${inventory.getAmount("nameChanger")}**`);
  input.setReply(i.messageID, {
    key: "changename",
    isRequire,
    name,
    userData,
    inventory,
    author: input.senderID,
    detectID: i.messageID,
  });
}

export async function reply({ input, output, repObj, money }) {
  try {
    if (repObj.author !== input.senderID) {
      return output.reply(`This is not your name change request.`);
    }
    const { name, userData, inventory, author } = repObj;
    if (input.words[0] === "back") {
      return output.reply(`It's okay, go back!`);
    }
    if (!input.body.toLowerCase().startsWith("proceed")) {
      return;
    }
    inventory.deleteOne("nameChanger");
    userData.inventory = Array.from(inventory);
    userData.name = name;
    input.delReply(repObj.detectID);
    await money.set(author, {
      inventory: userData.inventory,
      name: userData.name,
    });
    return output.reply(`✅ Successfully changed your name to "${name}"`);
  } catch (error) {
    console.error(error);
    output.error(error);
  }
}
