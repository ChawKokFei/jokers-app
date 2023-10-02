import "./App.css";
import { PeraWalletConnect } from "@perawallet/connect";
import algosdk, { waitForConfirmation } from "algosdk";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { useEffect, useState } from "react";

// Create the PeraWalletConnect instance outside the component
const peraWallet = new PeraWalletConnect();

// The app ID on testnet
const appIndex = 406146641;

// connect to the algorand node
const algod = new algosdk.Algodv2(
  "",
  "https://testnet-api.algonode.cloud",
  443
);

function App() {
  const [accountAddress, setAccountAddress] = useState(null);
  const isConnectedToPeraWallet = !!accountAddress;
  const [currentStage, setCurrentStage] = useState(null);
  const [paymentReleased, setPaymentReleased] = useState(null);

  useEffect(() => {
    checkLocalContractState();
    // reconnect to session when the component is mounted
    peraWallet.reconnectSession().then((accounts) => {
      // Setup the disconnect event listener
      peraWallet.connector?.on("disconnect", handleDisconnectWalletClick);

      if (accounts.length) {
        setAccountAddress(accounts[0]);
      }
    });
  }, []);

  return (
    <Container className="App-header">
      <meta name="name" content="Jokers" />
      <h1>Jokers</h1>
      <Row>
        <Col>
          <Button
            className="btn-wallet"
            onClick={
              isConnectedToPeraWallet
                ? handleDisconnectWalletClick
                : handleConnectWalletClick
            }
          >
            {isConnectedToPeraWallet ? "Disconnect" : "Connect to Pera Wallet"}
          </Button>
        </Col>
        <Col>
          <Button className="btn-wallet" onClick={() => optInToApp()}>
            Opt-in
          </Button>
        </Col>
      </Row>

      <Container>
        <Row>
          <Col>
            <Button className="btn-stage" onClick={confirmOrder}>
              Order Item
            </Button>
          </Col>
          <Col>
            <Button className="btn-stage" onClick={initiateDelivery}>
              Drop Item
            </Button>
          </Col>
          <Col>
            <Button className="btn-stage" onClick={confirmDelivery}>
              Deliver Item
            </Button>
          </Col>
          <Col>
            <Button className="btn-stage" onClick={confirmReceipt}>
              Confirm Receipt & Release Payment
            </Button>
          </Col>
          <Col>
            <Button className="btn-stage" onClick={reset}>
              Reset
            </Button>
          </Col>
        </Row>
        <br />
        <Row>
          <Col>
            <h3>Current Stage</h3>
            <span className="stage-text">{currentStage}</span>
          </Col>
          <Col>
            <h3>Payment Released</h3>
            <span className="payment-text">
              {paymentReleased ? "Yes" : "No"}
            </span>
          </Col>
        </Row>
      </Container>
    </Container>
  );

  async function checkLocalContractState() {
    try {
      const accountInfo = await algod
        .accountApplicationInformation(accountAddress, appIndex)
        .do();
      const localContract = accountInfo["app-local-state"]["key-value"];

      if (!!localContract[1].value.uint) {
        if (localContract[1].value.uint === 1) {
          setCurrentStage("Item ordered");
        } else if (localContract[1].value.uint === 2) {
          setCurrentStage("Item dropped");
        } else if (localContract[1].value.uint === 3) {
          setCurrentStage("Item delivered");
        } else if (localContract[1].value.uint === 4) {
          setCurrentStage("Item received");
        }
      } else {
        setCurrentStage("Item in cart");
      }

      setPaymentReleased(Boolean(localContract[0].value.uint));
    } catch (e) {
      console.error("There was an error connecting to the algorand node: ", e);
      setCurrentStage("Item in cart");
    }
  }

  function handleConnectWalletClick() {
    peraWallet.connect().then((newAccounts) => {
      // setup the disconnect event listener
      peraWallet.connector?.on("disconnect", handleDisconnectWalletClick);

      setAccountAddress(newAccounts[0]);
    });
  }

  function handleDisconnectWalletClick() {
    peraWallet.disconnect();
    setAccountAddress(null);
  }

  async function confirmOrder() {
    callApplication("ItemInCart");
  }

  async function initiateDelivery() {
    callApplication("ItemDropped");
  }

  async function confirmDelivery() {
    callApplication("ItemDelivered");
  }

  async function confirmReceipt() {
    callApplication("ItemReceived");
  }

  async function reset() {
    callApplication("Reset");
  }

  async function callApplication(action) {
    try {
      const suggestedParams = await algod.getTransactionParams().do();
      const appArgs = [
        new Uint8Array(Buffer.from(action)),
        new Uint8Array(Buffer.from("new")),
      ];

      const actionTx = algosdk.makeApplicationNoOpTxn(
        accountAddress,
        suggestedParams,
        appIndex,
        appArgs
      );

      const actionTxGroup = [{ txn: actionTx, signers: [accountAddress] }];

      const signedTx = await peraWallet.signTransaction([actionTxGroup]);
      const { txId } = await algod.sendRawTransaction(signedTx).do();
      const result = await waitForConfirmation(algod, txId, 2);
      checkLocalContractState();
    } catch (e) {
      console.error(`There was an error calling the contract: ${e}`);
    }
  }

  async function optInToApp() {
    const suggestedParams = await algod.getTransactionParams().do();
    const optInTxn = algosdk.makeApplicationOptInTxn(
      accountAddress,
      suggestedParams,
      appIndex
    );

    const optInTxGroup = [{ txn: optInTxn, signers: [accountAddress] }];

    const signedTx = await peraWallet.signTransaction([optInTxGroup]);
    console.log(signedTx);
    const { txId } = await algod.sendRawTransaction(signedTx).do();
    const result = await waitForConfirmation(algod, txId, 2);
  }
}

export default App;
