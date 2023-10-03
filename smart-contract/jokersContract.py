from pyteal import *


def approval_program():
    # Define the keys for the global and local state
    stage_key = Bytes("Stage")
    payment_released_key = Bytes("PaymentReleased")

    # Define the stages of the delivery process
    item_ordered_stage = Int(1)
    item_dropped_stage = Int(2)
    item_delivered_stage = Int(3)
    item_received_stage = Int(4)

    handle_optin = Return(Int(1))
    handle_closeout = Return(Int(0))
    handle_updateapp = Return(Int(0))
    handle_deleteapp = Return(Int(0))

    # Define the application call transaction
    on_initial_call = Seq([
        Return(Int(1))
    ])

    on_item_in_cart = Seq([
        App.localPut(Txn.sender(), stage_key, item_ordered_stage),
        App.localPut(Txn.sender(), payment_released_key, Int(0)),
        Return(Int(1))
    ])

    on_item_ordered = Seq([
        Assert(App.localGet(Txn.sender(), stage_key) == item_ordered_stage),
        App.localPut(Txn.sender(), stage_key, item_dropped_stage),
        Return(Int(1))
    ])

    on_item_dropped = Seq([
        Assert(App.localGet(Txn.sender(), stage_key) == item_dropped_stage),
        App.localPut(Txn.sender(), stage_key, item_delivered_stage),
        Return(Int(1))
    ])

    on_item_received = Seq([
        Assert(App.localGet(Txn.sender(), stage_key) == item_delivered_stage),
        App.localPut(Txn.sender(), stage_key, item_received_stage),
        App.localPut(Txn.sender(), payment_released_key, Int(1)),
        Return(Int(1))
    ])

    reset = Seq([
        App.localPut(Txn.sender(), stage_key, Int(0)),
        App.localPut(Txn.sender(), payment_released_key, Int(0)),
        Return(Int(1))
    ])

    handle_noop = Seq(
        Assert(Global.group_size() == Int(1)),
        Cond(
            [Txn.application_args[0] == Bytes(
                "ItemInCart"), on_item_in_cart],
            [Txn.application_args[0] == Bytes(
                "ItemDropped"), on_item_ordered],
            [Txn.application_args[0] == Bytes(
                "ItemDelivered"), on_item_dropped],
            [Txn.application_args[0] == Bytes(
                "ItemReceived"), on_item_received],
            [Txn.application_args[0] == Bytes(
                "Reset"), reset],
        )
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_initial_call],
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        [Txn.on_completion() == OnComplete.CloseOut, handle_closeout],
        [Txn.on_completion() == OnComplete.UpdateApplication, handle_updateapp],
        [Txn.on_completion() == OnComplete.DeleteApplication, handle_deleteapp],
        [Txn.on_completion() == OnComplete.NoOp, handle_noop]
    )

    return compileTeal(program, mode=Mode.Application, version=5)


def clear_state_program():
    program = Seq([
        Return(Int(1))
    ])

    return compileTeal(program, mode=Mode.Application, version=5)


# Write to file
appFile = open('approval.teal', 'w')
appFile.write(approval_program())
appFile.close()

clearFile = open('clear.teal', 'w')
clearFile.write(clear_state_program())
clearFile.close()
