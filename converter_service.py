# sends message
import json
import time

import requests
import zmq


def convert_currency():
    """
    Receives the request, JSON formatted data, makes an API call
    to UniRate API to get current exchange rate, then converts the
    currency amount.
    This is all sent back to the main program by
    using ZeroMQ communication pipelines.
    :param from: string, starting currency
    :param to: string, ending currency
    :param amount: float, amount to be converted
    :return: converted_response is converted amount and is sent as a
    JSON object back to the main program.

    ex:
    request = {
        "api_key": "API_KEY",
        "from" : "USD",
        "to" : "EUR",
        "amount" : 100.00 }

    converted_response = {
                "from": "currency_from",
                "to": "currency_to",
                "amount": amount,
                "rate": rate,
                "converted_currency": converted_currency
            }
    """

    context = zmq.Context()
    socket = context.socket(zmq.REP)
    socket.bind("tcp://localhost:7777")

    print("Microservice listening...")
    while True:
        try:
            # receive request from main program
            data = socket.recv_json()
            data_from = data["from"]
            data_to = data["to"]
            data_amount = data["amount"]

            print(f"Receiving request... {data_from} to {data_to} amount to convert: {float(data_amount):.2f}")

            api_key = str(data["api_key"])
            currency_from = str(data["from"])
            currency_to = str(data["to"])
            amount = float(data["amount"])

            # API call to get rates for conversion
            url = "https://api.unirateapi.com/api/rates"
            api_params = {
                "api_key": api_key,
                "from": currency_from,
                "to": currency_to
                }

            response = requests.get(url, params=api_params)
            rate_data = response.json()
            rate = float(rate_data["rate"])
            converted_amount = float(rate * amount)
            converted_currency = {
                "from": currency_from,
                "to": currency_to,
                "amount": amount,
                "rate": rate,
                "converted_amount": converted_amount
            }

            print("Sent data: " + f"{converted_currency}")
            print("Converted " + f"{amount:.2f}" + f"{currency_from}" +
                  " to " + f"{converted_amount:.2f}" + f"{currency_to}")

            # send data back to main program
            socket.send_json(converted_currency)

        except (requests.RequestException, KeyError, ValueError) as e:
            print("Error with request!", str(e))
            socket.send_json({"error": str(e)})


if __name__ == "__main__":
    convert_currency()