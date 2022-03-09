import main from "./main.js";

window.addEventListener("load", () => {
  //When the 'Create room" is button is clicked
  document.getElementById("create-room").addEventListener("click", (e) => {
    e.preventDefault();

    console.log("In create-room");

    let roomName = document.querySelector("#room-name").value;
    let yourName = document.querySelector("#your-name").value;

    console.log(document.querySelector("#room-name"));
    console.log(document.querySelector("#your-name"));

    if (roomName && yourName) {
      //remove error message, if any
      document.querySelector("#err-msg").innerHTML = "";

      //save the user's name in sessionStorage
      sessionStorage.setItem("username", yourName);

      //create room link
      let roomLink = `${location.origin}/call?room=${roomName
        .trim()
        .replace(" ", "_")}_${main.generateRandomString()}`;

      //show message with link to room
      document.querySelector(
        "#room-created"
      ).innerHTML = `Your meeting's ready! Start the <a href='${roomLink}'>Meet</a>!`;


//       let a=document.getElementById("share");    
//       let b="Hey! you are invited to join this meet! Below are the meeting details.";
//       let c=`Welcome to the microsoft teams ! Click this link to join the <a>'${roomLink}'</a>`;
// function aadi()
// {
//     a.href=`mailto:?subject='${b}'&body='${c}'`;
// }
// document.getElementById("share").onclick(aadi());
      //empty the values
      document.querySelector("#room-name").value = "";
      document.querySelector("#your-name").value = "";
    } else {
      document.querySelector("#err-msg").innerHTML = "All fields are required";
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("expand-remote-video")) {
      main.maximiseStream(e);
    } else if (e.target && e.target.classList.contains("mute-remote-mic")) {
      main.singleStreamToggleMute(e);
    }
  });
});

// If user already have link
let roomname;
function existingroomjoin()
{
   roomname = document.querySelector("#existroom").value;
   document.getElementById("ejoinroom").href=roomname;

}

document.getElementById("ejoinroom").addEventListener("click",()=>{
  existingroomjoin();
  console.log(roomname);
})

