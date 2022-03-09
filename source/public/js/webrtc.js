
import main from "./main.js";

let item = document.querySelector("#secondnav");

window.addEventListener("load", () => {
  const room = main.getQString(location.href, "room");
  const username = sessionStorage.getItem("username");

  if (!room) {
    // document.querySelector("#room-create").attributes.removeNamedItem("hidden");
    // item.setAttribute("hidden",true);
  } else if (!username) {
    document
      .querySelector("#username-set")
      .attributes.removeNamedItem("hidden");
      item.setAttribute("hidden",true);
  } else {
    var pc = [];

    let socket = io("/stream");

    var socketId = "";
    var myStream = "";
    var screen = "";
    var recordedStream = [];
    var mediaRecorder = "";

    //Get user video by default
    getAndSetUserStream();

    socket.on("connect", () => {
      //set socketId
      socketId = socket.io.engine.id;

      socket.emit("subscribe", {
        room: room,
        socketId: socketId,
      });

      socket.on("new user", (data) => {
        socket.emit("newUserStart", { to: data.socketId, sender: socketId });
        pc.push(data.socketId);
        init(true, data.socketId);
      });

      socket.on("newUserStart", (data) => {
        pc.push(data.sender);
        init(false, data.sender);
      });

      socket.on("ice candidates", async (data) => {
        data.candidate
          ? await pc[data.sender].addIceCandidate(
              new RTCIceCandidate(data.candidate)
            )
          : "";
      });

      socket.on("sdp", async (data) => {
        if (data.description.type === "offer") {
          data.description
            ? await pc[data.sender].setRemoteDescription(
                new RTCSessionDescription(data.description)
              )
            : "";

          main.getUserFullMedia()
            .then(async (stream) => {
              if (!document.getElementById("local").srcObject) {
                main.setLocalStream(stream);
              }

              //save my stream
              myStream = stream;

              stream.getTracks().forEach((track) => {
                pc[data.sender].addTrack(track, stream);
              });

              let answer = await pc[data.sender].createAnswer();

              await pc[data.sender].setLocalDescription(answer);

              socket.emit("sdp", {
                description: pc[data.sender].localDescription,
                to: data.sender,
                sender: socketId,
              });
            })
            .catch((e) => {
              console.error(e);
            });
        } else if (data.description.type === "answer") {
          await pc[data.sender].setRemoteDescription(
            new RTCSessionDescription(data.description)
          );
        }
      });

      socket.on("chat", (data) => {
        main.addChat(data, "remote");
      });
    });

    function getAndSetUserStream() {
      main.getUserFullMedia()
        .then((stream) => {
          //save my stream
          myStream = stream;

          main.setLocalStream(stream);
        })
        .catch((e) => {
          console.error(`stream error: ${e}`);
        });
    }

    function sendMsg(msg) {
      let data = {
        room: room,
        msg: msg,
        sender: username,
      };

      //emit chat message
      socket.emit("chat", data);

      //add localchat
      main.addChat(data, "local");
    }

    function init(createOffer, partnerName) {
      pc[partnerName] = new RTCPeerConnection(main.getIceServer());

      if (screen && screen.getTracks().length) {
        screen.getTracks().forEach((track) => {
          pc[partnerName].addTrack(track, screen); //should trigger negotiationneeded event
        });
      } else if (myStream) {
        myStream.getTracks().forEach((track) => {
          pc[partnerName].addTrack(track, myStream); //should trigger negotiationneeded event
        });
      } else {
        main.getUserFullMedia()
          .then((stream) => {
            //save my stream
            myStream = stream;

            stream.getTracks().forEach((track) => {
              pc[partnerName].addTrack(track, stream); //should trigger negotiationneeded event
            });

            main.setLocalStream(stream);
          })
          .catch((e) => {
            console.error(`stream error: ${e}`);
          });
      }

      //create offer
      if (createOffer) {
        pc[partnerName].onnegotiationneeded = async () => {
          let offer = await pc[partnerName].createOffer();

          await pc[partnerName].setLocalDescription(offer);

          socket.emit("sdp", {
            description: pc[partnerName].localDescription,
            to: partnerName,
            sender: socketId,
          });
        };
      }

      //send ice candidate to partnerNames
      pc[partnerName].onicecandidate = ({ candidate }) => {
        socket.emit("ice candidates", {
          candidate: candidate,
          to: partnerName,
          sender: socketId,
        });
      };

      //add
      pc[partnerName].ontrack = (e) => {
        let str = e.streams[0];
        if (document.getElementById(`${partnerName}-video`)) {
          document.getElementById(`${partnerName}-video`).srcObject = str;
        } else {
          //video elem
          let newVid = document.createElement("video");
          newVid.id = `${partnerName}-video`;
          newVid.srcObject = str;
          newVid.autoplay = true;
          newVid.className = "remote-video";

          //video controls elements
          let controlDiv = document.createElement("div");
          controlDiv.className = "remote-video-controls";
          controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                        <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

          //create a new div for card
          let cardDiv = document.createElement("div");
          cardDiv.className = "card card-sm";
          cardDiv.id = partnerName;
          cardDiv.appendChild(newVid);
          cardDiv.appendChild(controlDiv);

          //put div in main-section elem
          document.getElementById("videos").appendChild(cardDiv);

          main.adjustVideoElemSize();
        }
      };

      pc[partnerName].onconnectionstatechange = (d) => {
        switch (pc[partnerName].iceConnectionState) {
          case "disconnected":
          case "failed":
            main.closeVideo(partnerName);
            break;

          case "closed":
            main.closeVideo(partnerName);
            break;
        }
      };

      pc[partnerName].onsignalingstatechange = (d) => {
        switch (pc[partnerName].signalingState) {
          case "closed":
            console.log("Signalling state is 'closed'");
            main.closeVideo(partnerName);
            break;
        }
      };
    }

    function shareScreen() {
      main.shareScreen()
        .then((stream) => {
          main.toggleShareIcons(true);
          main.toggleVideoBtnDisabled(true);
          screen = stream;
          broadcastNewTracks(stream, "video", false);
          screen.getVideoTracks()[0].addEventListener("ended", () => {
            stopSharingScreen();
          });
        })
        .catch((e) => {
          console.error(e);
        });
    }

    function stopSharingScreen() {
      //enable video toggle btn
      main.toggleVideoBtnDisabled(false);

      return new Promise((res, rej) => {
        screen.getTracks().length
          ? screen.getTracks().forEach((track) => track.stop())
          : "";

        res();
      })
        .then(() => {
          main.toggleShareIcons(false);
          broadcastNewTracks(myStream, "video");
        })
        .catch((e) => {
          console.error(e);
        });
    }

    function broadcastNewTracks(stream, type, mirrorMode = true) {
      main.setLocalStream(stream, mirrorMode);

      let track =
        type == "audio"
          ? stream.getAudioTracks()[0]
          : stream.getVideoTracks()[0];

      for (let p in pc) {
        let pName = pc[p];

        if (typeof pc[pName] == "object") {
          main.replaceTrack(track, pc[pName]);
        }
      }
    }

    function toggleRecordingIcons(isRecording) {
      let e = document.getElementById("record");

      if (isRecording) {
        e.setAttribute("title", "Stop recording");
        e.children[0].classList.add("text-danger");
        e.children[0].classList.remove("text-white");
      } else {
        e.setAttribute("title", "Record");
        e.children[0].classList.add("text-white");
        e.children[0].classList.remove("text-danger");
      }
    }

    function startRecording(stream) {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });

      mediaRecorder.start(1000);
      toggleRecordingIcons(true);

      mediaRecorder.ondataavailable = function (e) {
        recordedStream.push(e.data);
      };

      mediaRecorder.onstop = function () {
        toggleRecordingIcons(false);

        main.saveRecordedStream(recordedStream, username);

        setTimeout(() => {
          recordedStream = [];
        }, 3000);
      };

      mediaRecorder.onerror = function (e) {
        console.error(e);
      };
    }

    //Chat textarea
    document.getElementById("chat-input").addEventListener("keypress", (e) => {
      if (e.which === 13 && e.target.value.trim()) {
        e.preventDefault();

        sendMsg(e.target.value);

        setTimeout(() => {
          e.target.value = "";
        }, 50);
      }
    });

    //When the video icon is clicked
    document.getElementById("toggle-video").addEventListener("click", (e) => {
      e.preventDefault();

      let elem = document.getElementById("toggle-video");

      if (myStream.getVideoTracks()[0].enabled) {
        e.target.classList.remove("fa-video");
        e.target.classList.add("fa-video-slash");
        elem.setAttribute("title", "Show Video");

        myStream.getVideoTracks()[0].enabled = false;
      } else {
        e.target.classList.remove("fa-video-slash");
        e.target.classList.add("fa-video");
        elem.setAttribute("title", "Hide Video");

        myStream.getVideoTracks()[0].enabled = true;
      }

      broadcastNewTracks(myStream, "video");
    });

    //When the mute icon is clicked
    document.getElementById("toggle-mute").addEventListener("click", (e) => {
      e.preventDefault();

      let elem = document.getElementById("toggle-mute");

      if (myStream.getAudioTracks()[0].enabled) {
        e.target.classList.remove("fa-microphone-alt");
        e.target.classList.add("fa-microphone-alt-slash");
        elem.setAttribute("title", "Unmute");

        myStream.getAudioTracks()[0].enabled = false;
      } else {
        e.target.classList.remove("fa-microphone-alt-slash");
        e.target.classList.add("fa-microphone-alt");
        elem.setAttribute("title", "Mute");

        myStream.getAudioTracks()[0].enabled = true;
      }

      broadcastNewTracks(myStream, "audio");
    });

    //When user clicks the 'Share screen' button
    document.getElementById("share-screen").addEventListener("click", (e) => {
      e.preventDefault();

      if (
        screen &&
        screen.getVideoTracks().length &&
        screen.getVideoTracks()[0].readyState != "ended"
      ) {
        stopSharingScreen();
      } else {
        shareScreen();
      }
    });

    //When record button is clicked
    document.getElementById("record").addEventListener("click", (e) => {
      /**
       * Ask user what they want to record.
       * Get the stream based on selection and start recording
       */
      if (!mediaRecorder || mediaRecorder.state == "inactive") {
        main.toggleModal("recording-options-modal", true);
      } else if (mediaRecorder.state == "paused") {
        mediaRecorder.resume();
      } else if (mediaRecorder.state == "recording") {
        mediaRecorder.stop();
      }
    });

    //When user choose to record screen
    document.getElementById("record-screen").addEventListener("click", () => {
      main.toggleModal("recording-options-modal", false);

      if (screen && screen.getVideoTracks().length) {
        startRecording(screen);
      } else {
        main.shareScreen()
          .then((screenStream) => {
            startRecording(screenStream);
          })
          .catch(() => {});
      }
    });

    //When user choose to record own video
    document.getElementById("record-video").addEventListener("click", () => {
      main.toggleModal("recording-options-modal", false);

      if (myStream && myStream.getTracks().length) {
        startRecording(myStream);
      } else {
        main.getUserFullMedia()
          .then((videoStream) => {
            startRecording(videoStream);
          })
          .catch(() => {});
      }
    });
  }
});

let shareData = {
  title: 'Meeting Link',
  text: 'Hi, I am inviting you to join a meeting happening now . Please click on the link given to join the meeting.',
  url: window.location.href,
}

const btn = document.querySelector('#click');
//   const resultPara = document.querySelector('.result');/

if(btn)
{
  btn.addEventListener("click", async () => {
    await navigator.share(shareData)
});
}