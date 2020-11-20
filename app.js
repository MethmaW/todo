//jshint esversion:6

console.log('Server-side code is running');

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();

dotenv.config();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

// mongoose.connect("mongodb://localhost:27017/todolistDB", {
mongoose.connect(process.env.mongo_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});

const itemsSchema = new mongoose.Schema({
  name: {
    type: String
    // required: [true, "Please check your data entry, no name specified!"]
    // unique: true
  },
  status: Boolean
});

const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
  name: "Welcome to your todolist!"
});

const defaultItems = [item1];
const defaultListItems = [];

const listSchema = new mongoose.Schema({
  name: {
    type: String
    // required: [true, "Please check your data entry, no name specified!"]
    // unique: true
  },
  items: [itemsSchema]
});

const List = mongoose.model("List", listSchema);

app.get("/", function(req, res) {
  List.find({}, {
    _id: 1,
    name: 1
  }, function(req, listArray) {
    res.render("home", {
      listName: listArray
    });
  });
});

app.get("/MyTasks", function(req, res) {
  Item.find({}, function(err, foundItems) {
    if (foundItems.length === 0) {
      Item.insertMany(defaultItems, function(err) {
        if (err) {
          console.log("Item has not been added to the list!");
        } else {
          console.log("Items sucessfully added to the list!");
        }
        res.redirect("/MyTasks");
      });
    } else {
      res.render("list", {
        listTitle: "My Tasks",
        newListItems: foundItems
      });
    }
  });
});

app.get("/custom/:customListName", function(req, res) {
  const customListName = _.capitalize(req.params.customListName);
  List.findOne({
    name: customListName
  }, function(err, foundList) {
    if (!err) {
      if (!foundList) {
        // console.log("The list does not exist");
        const list = new List({
          name: customListName,
          items: defaultListItems
        });
        list.save((err, result) => {
          console.log(err);
          res.redirect("/custom/" + customListName);
        });
      } else {
        // console.log("The list does exist");
        res.render("list", {
          listTitle: foundList.name,
          newListItems: foundList.items
        });
      }
    }
  });
});

app.get("/about", function(req, res) {
  res.render("about");
});

app.post("/MyTasks", function(req, res) {
  const itemName = req.body.newItem;
  const listName = req.body.list;
  const item = new Item({
    name: itemName
  });
  if (listName === "My Tasks") {
    item.save();
    res.redirect("/MyTasks");
  } else {
    List.findOne({
      name: listName
    }, function(err, foundList) {
      foundList.items.push(item);
      // foundList.save();
      foundList.save((err, result) => {
        res.redirect("/custom/" + listName);
      });
    });
  }
});

app.post("/custom/newList", function(req, res) {
  const newListName = _.capitalize(req.body.newList);
  if (!newListName) {
    console.log("Name for new list has not been filled in the form!");
    res.redirect("/");
  } else {
    List.findOne({
      name: newListName
    }, function(err, foundList) {
      if (!err) {
        if (!foundList) {
          console.log("The list does not exist");
          const newList = new List({
            name: newListName,
            items: defaultListItems
          });
          newList.save((err, result) => {
            res.redirect("/custom/" + newListName);
          });
        } else {
          console.log("The list does exist");
          res.render("list", {
            listTitle: foundList.name,
            newListItems: foundList.items
          });
        }
      }
    });
  }
});

app.post("/changeItemStatus", function(req, res) {
  const checkedValue = req.body.checkItem;
  const obj = JSON.parse(req.body.itemId);
  const checkedItemId = obj.itemId;
  const listName = obj.listName;
  const itemName = req.body.updatedItem;
  // const updatedItem = req.body.updatedItem;
  console.log(itemName);

  function setRoute() {
    if (listName === "My Tasks") {
      // let rePath = "/MyTasks";
      // console.log(rePath);
      return "/MyTasks";
    } else {
      // let rePath = "/customListName/" + listName;
      // console.log(rePath);
      return "/custom/" + listName;
    }
  }

  function setCheckboxStatus() {
    if (checkedValue) {
      return true;
    } else {
      return false;
    }
  }

  function updateItem() {
    Item.findByIdAndUpdate({
        _id: checkedItemId
      }, {
        name: itemName,
        status: setCheckboxStatus()
      },
      function(err, result) {
        if (err) {
          console.log(err);
        } else {
          console.log("Sucessfully updated the item!");
          res.redirect(setRoute());
        }
      });
  }

  function updateList() {
    List.updateOne({
      name: listName,
      'items._id': checkedItemId
    }, {
      $set: {
        'items.$.name': itemName,
        'items.$.status': setCheckboxStatus(),
      }
    }, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        console.log("Sucessfully updated the item!");
        res.redirect(setRoute());
      }
    });
  }

  if (listName === "My Tasks") {
    updateItem();
  } else {
    updateList();
  }

});

app.post("/deleteList", function(req, res) {
  const checkedListId = req.body.deleteButton;
  console.log(checkedListId);
  List.findByIdAndRemove(checkedListId, function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("Sucessfully deleted the checked item!");
      res.redirect("/");
    }
  });
});

app.post("/deleteItem", function(req, res) {
  const obj = JSON.parse(req.body.deleteButton); //all fields come from json object in list.ejs
  const checkedItemId = obj.itemId;
  const listName = obj.listName;
  if (listName === "My Tasks") {
    Item.findByIdAndRemove(checkedItemId, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log("Sucessfully deleted the checked item!");
        res.redirect("/MyTasks");
      }
    });
  } else {
    List.findOneAndUpdate({
      name: listName
    }, {
      $pull: {
        items: {
          _id: checkedItemId
        }
      }
    }, function(err, foundList) {
      if (!err) {
        console.log("Sucessfully deleted the checked item!");
        res.redirect("/custom/" + listName);
      } else {
        console.log(err);
      }
    });
  }
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server started successfully on Port" + port);
});
