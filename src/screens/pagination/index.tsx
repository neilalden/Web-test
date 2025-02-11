import Colors from '@/common/colors';
import Images from '@/common/images';
import TextInput from '@/components/TextInput';
import useKeyListener from '@/hooks/useKeyListener';
import { useAuth } from '@/services/context/AuthContext';
import { googleSignIn } from '@/services/firebase/auth';
import { createDocument, createId } from '@/services/firebase/firestore';
import { MessageType } from '@/types';
import { sanitizeString } from '@/utils/functions';
import { TSDate } from '@/utils/variables';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import MessageRow from './components/MessageRow';
import { orderBy, query, limit, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { getDocs, collection } from 'firebase/firestore';
import { firestore } from '@/services/firebase/config';

const Pagination = () => {
    const { Auth, logout } = useAuth();
    const [message, setMessage] = useState("");
    const [messageError, setMessageError] = useState(false);
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [lastDoc, setLastDoc] = useState<null | QueryDocumentSnapshot<DocumentData>>(null);
    const [loading, setLoading] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async (loadMore = false) => {
        setLoading(true);
        let q = query(collection(firestore, "messages"), orderBy("createdAt", "desc"), limit(20));
        if (loadMore && lastDoc) {
            q = query(collection(firestore, "messages"), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(20));
        }
        const snapshot = await getDocs(q);
        const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageType));
        setMessages(prev => (loadMore ? [...prev, ...newMessages] : newMessages));
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setLoading(false);
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (messagesContainerRef.current && messagesContainerRef.current.scrollTop === 0 && !loading) {
                fetchMessages(true);
            }
        };
        messagesContainerRef.current?.addEventListener("scroll", handleScroll);
        return () => messagesContainerRef.current?.removeEventListener("scroll", handleScroll);
    }, [lastDoc, loading]);

    const sendMessage = useCallback(async () => {
        if (!Auth) return;
        const sanitized = sanitizeString(message);
        if (typeof message !== "string" || sanitized.trim() === "") return setMessageError(true);
        await createDocument<MessageType>({
            Collection: "messages",
            Data: {
                authorId: Auth.uid,
                createdAt: TSDate(),
                id: createId("messages"),
                message: sanitized
            }
        });
        setMessage("");
        fetchMessages();
    }, [message, Auth]);

    const handleSend = useCallback(async () => {
        if (!Auth) {
            await googleSignIn().then((response) => {
                if (response.status !== 200) alert(response.message);
                else sendMessage();
            });
        } else sendMessage();
    }, [Auth, sendMessage]);

    useKeyListener({
        key: "Enter",
        callback: handleSend,
        dependencies: [handleSend, Auth]
    });

    return (
        <>
            <div
                style={{
                    background: Colors.black500,
                    top: `${innerHeight / 4}px`,
                    left: `calc(50% - 200px)`
                }}
                className="m-auto br-15px card text-center w-400px h-min-400px h-50vh absolute col gap-5px">
                <div
                    ref={messagesContainerRef}
                    className="col-reverse gap-3px h-100p overflow-y-scroll visible-scrollbar">
                    {messages.map((msg) => <MessageRow message={msg} key={msg.id} />)}
                </div>
                <div className="row-center">
                    <TextInput
                        value={message}
                        setValue={(e) => {
                            setMessage(e.target.value);
                            if (messageError) setMessageError(false);
                        }}
                        error={messageError}
                        inputClassName='bootstrap-input'
                        containerClassName='m-3px w-100p'
                    />
                    <button
                        onClick={handleSend}
                        className='h-30px w-30px'
                        style={{ background: Colors.transparent }}
                        type="button">
                        <img
                            className='h-25px w-25px mr-3px'
                            src={Images["ic_send_white"]} />
                    </button>
                </div>
            </div>
            {Auth && (
                <button
                    style={{
                        bottom: "100px",
                        left: "calc(50% - 39px)",
                        border: "1px solid " + Colors.white
                    }}
                    onClick={logout}
                    className='absolute br-3px pv-5px ph-15px'
                    type="button">
                    Logout
                </button>
            )}
        </>
    );
};

export default Pagination;
